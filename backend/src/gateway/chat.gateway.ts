import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../users/user.schema';
import { MessageType } from '../chat/message.schema';
import { RedisService } from '../redis/redis.service';

// CORS fix: function evaluated at request time so FRONTEND_URL is always resolved
@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
      ];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  },
  namespace: '/chat',
  maxHttpBufferSize: 5e6,
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  // userId → Set<socketId>
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
  ) {}

  // ─── Connection ────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) { client.disconnect(); return; }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.email  = payload.email;

      // Track sockets per user
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub).add(client.id);

      // Personal room
      client.join(`user:${payload.sub}`);

      // Join all existing conversation rooms
      const conversations = await this.chatService.getUserConversations(payload.sub);

      // Bug #3 fix: cache conv IDs so disconnect does not need a DB round-trip
      client.data.conversationIds = conversations.map((conv) => conv._id.toString());

      conversations.forEach((conv) => {
        client.join(`conv:${conv._id.toString()}`);
      });

      // Mark online
      await this.usersService.updateStatus(payload.sub, UserStatus.ONLINE);
      await this.redisService.setUserOnline(payload.sub, client.id);

      // Bug #3 fix: emit only to shared conversation rooms, not all sockets globally
      conversations.forEach((conv) => {
        client.to(`conv:${conv._id.toString()}`).emit('user:status', {
          userId: payload.sub,
          status: UserStatus.ONLINE,
        });
      });

      this.logger.log(`Connected: ${client.id} (user: ${payload.sub})`);
    } catch (err) {
      this.logger.warn(`Auth failed for ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        await this.usersService.updateStatus(userId, UserStatus.OFFLINE);
        await this.redisService.setUserOffline(userId);

        // Bug #3 fix: use cached IDs — avoids DB query on hot disconnect path
        const convIds: string[] = client.data.conversationIds || [];
        convIds.forEach((convId) => {
          this.server.to(`conv:${convId}`).emit('user:status', { userId, status: UserStatus.OFFLINE });
        });
      }
    }
    this.logger.log(`Disconnected: ${client.id}`);
  }

  // ─── Send message ─────────────────────────────────────────────────────────

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      conversationId: string;
      content: string;
      type?: MessageType;
      replyTo?: string;
      encryptedContent?: string;
      media?: any;
      tempId?: string;
    },
  ) {
    const senderId = client.data.userId;
    if (!senderId) return { error: 'Unauthorized' };

    try {
      const message = await this.chatService.sendMessage(
        data.conversationId,
        senderId,
        data.content,
        data.type || MessageType.TEXT,
        data.replyTo,
        data.media,
        data.encryptedContent,
      );

      const convRoom = `conv:${data.conversationId}`;

      // ✅ 1. Ack sender — resolves their optimistic bubble
      client.emit('message:sent', { tempId: data.tempId, message });

      // ✅ 2. Push to every OTHER socket in the conversation room
      client.to(convRoom).emit('message:new', message);

      // ✅ 3. For any member who is online but NOT yet in the room
      //    (e.g. they just came online / missed the handleConnection room join)
      //    → force-join their socket to the room and push the conversation
      const memberIds = await this.chatService.getConversationMemberIds(data.conversationId);

      for (const memberId of memberIds) {
        if (memberId === senderId) continue;

        const memberSockets = this.userSockets.get(memberId);
        if (!memberSockets || memberSockets.size === 0) continue;

        for (const socketId of memberSockets) {
          // Bug fix: the original this.server.sockets.sockets.get(socketId) always returned
          // undefined (it searched the default '/' namespace, not '/chat') and the interim
          // .sockets.get() broke TS compilation. Use Socket.io v4 server-side APIs instead:
          // socketsJoin joins the socket to the room from the server side (no object lookup needed)
          this.server.in(socketId).socketsJoin(convRoom);
          this.logger.log(`Ensured ${socketId} (user ${memberId}) is in ${convRoom}`);

          // Push the message directly — room broadcast above already fired, so push individually
          this.server.to(socketId).emit('message:new', message);

          // Also push the full conversation so their sidebar updates
          const fullConv = await this.chatService.getConversation(
            data.conversationId,
            memberId,
          );
          this.server.to(socketId).emit('conversation:new', fullConv);
        }
      }

      return { success: true };
    } catch (err) {
      this.logger.error(`message:send error: ${err.message}`);
      client.emit('error', { event: 'message:send', message: err.message });
      return { error: err.message };
    }
  }

  // ─── Read receipts ─────────────────────────────────────────────────────────

  @SubscribeMessage('message:read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data.conversationId) return;

    await this.chatService.markMessagesAsRead(data.conversationId, userId);
    client.to(`conv:${data.conversationId}`).emit('message:read', {
      conversationId: data.conversationId,
      userId,
      timestamp: new Date(),
    });
  }

  // ─── Typing ────────────────────────────────────────────────────────────────

  @SubscribeMessage('typing:start')
  handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    if (!client.data.userId || !data.conversationId) return;
    client.to(`conv:${data.conversationId}`).emit('typing:start', {
      conversationId: data.conversationId,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    if (!client.data.userId || !data.conversationId) return;
    client.to(`conv:${data.conversationId}`).emit('typing:stop', {
      conversationId: data.conversationId,
      userId: client.data.userId,
    });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; conversationId: string; forEveryone?: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    try {
      await this.chatService.deleteMessage(data.messageId, userId, data.forEveryone);
      if (data.forEveryone) {
        this.server.to(`conv:${data.conversationId}`).emit('message:deleted', {
          messageId:      data.messageId,
          conversationId: data.conversationId,
        });
      }
    } catch (err) {
      client.emit('error', { event: 'message:delete', message: err.message });
    }
  }

  // ─── Edit ──────────────────────────────────────────────────────────────────

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; conversationId: string; content: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    try {
      const message = await this.chatService.editMessage(data.messageId, userId, data.content);
      this.server.to(`conv:${data.conversationId}`).emit('message:edited', message);
    } catch (err) {
      client.emit('error', { event: 'message:edit', message: err.message });
    }
  }

  // ─── Reactions ─────────────────────────────────────────────────────────────

  @SubscribeMessage('reaction:add')
  async handleAddReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; conversationId: string; emoji: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    try {
      // Bug #4 fix: emit full authoritative reactions array to prevent client-side drift
      const updatedMessage = await this.chatService.addReaction(data.messageId, userId, data.emoji);
      this.server.to(`conv:${data.conversationId}`).emit('reaction:updated', {
        messageId: data.messageId,
        reactions: updatedMessage.reactions,
      });
    } catch (err) {
      client.emit('error', { event: 'reaction:add', message: err.message });
    }
  }

  // ─── Join room ─────────────────────────────────────────────────────────────

  // Bug #5 fix: validate membership before allowing room join
  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.data.userId) return;
    try {
      // getConversation throws ForbiddenException if user is not a member
      await this.chatService.getConversation(data.conversationId, client.data.userId);
      client.join(`conv:${data.conversationId}`);
    } catch {
      client.emit('error', { event: 'conversation:join', message: 'Access denied' });
    }
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  @SubscribeMessage('status:update')
  async handleStatusUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: UserStatus },
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    await this.usersService.updateStatus(userId, data.status);

    // Bug #3 fix: emit only to shared conversation rooms, not all sockets
    const convIds: string[] = client.data.conversationIds || [];
    convIds.forEach((convId) => {
      this.server.to(`conv:${convId}`).emit('user:status', { userId, status: data.status });
    });
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
