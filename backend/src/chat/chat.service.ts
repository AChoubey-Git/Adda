import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument, ConversationType } from './conversation.schema';
import { Message, MessageDocument, MessageStatus, MessageType } from './message.schema';

// Fields we always populate on members
const MEMBER_FIELDS = 'name email avatar status lastSeen publicKey';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)      private messageModel:      Model<MessageDocument>,
  ) {}

  // ─── Conversations ─────────────────────────────────────────────────────────

  async getOrCreateDirectConversation(
    userA: string,
    userB: string,
  ): Promise<ConversationDocument> {
    // Look for existing direct conversation between the two users
    let conv = await this.conversationModel.findOne({
      type: ConversationType.DIRECT,
      'members.userId': {
        $all: [new Types.ObjectId(userA), new Types.ObjectId(userB)],
      },
      $expr: { $eq: [{ $size: '$members' }, 2] },
    });

    if (!conv) {
      conv = await this.conversationModel.create({
        type: ConversationType.DIRECT,
        members: [
          { userId: new Types.ObjectId(userA), role: 'member', joinedAt: new Date() },
          { userId: new Types.ObjectId(userB), role: 'member', joinedAt: new Date() },
        ],
      });
    }

    // ✅ ALWAYS return fully-populated document so frontend gets real user objects
    return this.conversationModel
      .findById(conv._id)
      .populate('members.userId', MEMBER_FIELDS)
      .populate('lastMessage')
      .exec();
  }

  async createGroupConversation(
    creatorId: string,
    name: string,
    memberIds: string[],
    description?: string,
  ): Promise<ConversationDocument> {
    const members = [
      { userId: new Types.ObjectId(creatorId), role: 'admin' as const, joinedAt: new Date() },
      ...memberIds.map((id) => ({
        userId: new Types.ObjectId(id),
        role: 'member' as const,
        joinedAt: new Date(),
      })),
    ];

    const conv = await this.conversationModel.create({
      type: ConversationType.GROUP,
      name,
      description,
      members,
    });

    // ✅ Return populated
    return this.conversationModel
      .findById(conv._id)
      .populate('members.userId', MEMBER_FIELDS)
      .exec();
  }

  async getUserConversations(userId: string): Promise<ConversationDocument[]> {
    return this.conversationModel
      .find({ 'members.userId': new Types.ObjectId(userId), isActive: true })
      .populate('members.userId', MEMBER_FIELDS)
      .populate('lastMessage')
      .sort({ lastActivity: -1 })
      .exec();
  }

  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDocument> {
    const conv = await this.conversationModel
      .findById(conversationId)
      .populate('members.userId', MEMBER_FIELDS)
      .populate('lastMessage')
      .exec();

    if (!conv) throw new NotFoundException('Conversation not found');

    const isMember = conv.members.some((m) => {
      const id = (m.userId as any)?._id?.toString() ?? m.userId?.toString();
      return id === userId;
    });
    if (!isMember) throw new ForbiddenException('Access denied');

    return conv;
  }

  async addGroupMember(
    conversationId: string,
    adminId: string,
    memberId: string,
  ): Promise<ConversationDocument> {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Group not found');
    if (conv.type !== ConversationType.GROUP) throw new ForbiddenException('Not a group');

    const admin = conv.members.find((m) => m.userId.toString() === adminId);
    if (!admin || admin.role !== 'admin')
      throw new ForbiddenException('Only admins can add members');

    return this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        {
          $addToSet: {
            members: { userId: new Types.ObjectId(memberId), role: 'member', joinedAt: new Date() },
          },
        },
        { new: true },
      )
      .populate('members.userId', MEMBER_FIELDS);
  }

  async removeGroupMember(
    conversationId: string,
    adminId: string,
    memberId: string,
  ): Promise<ConversationDocument> {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Group not found');

    const admin = conv.members.find((m) => m.userId.toString() === adminId);
    if (!admin || admin.role !== 'admin')
      throw new ForbiddenException('Only admins can remove members');

    return this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        { $pull: { members: { userId: new Types.ObjectId(memberId) } } },
        { new: true },
      )
      .populate('members.userId', MEMBER_FIELDS);
  }

  async promoteToAdmin(
    conversationId: string,
    adminId: string,
    memberId: string,
  ): Promise<void> {
    const conv = await this.conversationModel.findById(conversationId);
    const admin = conv?.members.find((m) => m.userId.toString() === adminId);
    if (!admin || admin.role !== 'admin')
      throw new ForbiddenException('Only admins can promote');

    await this.conversationModel.updateOne(
      { _id: conversationId, 'members.userId': new Types.ObjectId(memberId) },
      { $set: { 'members.$.role': 'admin' } },
    );
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: MessageType = MessageType.TEXT,
    replyTo?: string,
    media?: any,
    encryptedContent?: string,
  ): Promise<MessageDocument> {
    // Verify sender is a member
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Conversation not found');

    const isMember = conv.members.some(
      (m) => m.userId.toString() === senderId,
    );
    if (!isMember) throw new ForbiddenException('Access denied');

    const message = await this.messageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId:       new Types.ObjectId(senderId),
      content,
      encryptedContent,
      type,
      media,
      replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
      status:  MessageStatus.SENT,
    });

    // Update conversation's last message + activity timestamp
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage:  message._id,
      lastActivity: new Date(),
    });

    // Return with sender info populated
    return message.populate('senderId', 'name avatar _id');
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page  = 1,
    limit = 50,
  ): Promise<{ messages: MessageDocument[]; total: number; hasMore: boolean }> {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({
          conversationId: new Types.ObjectId(conversationId),
          isDeleted: false,
          deletedFor: { $ne: new Types.ObjectId(userId) },
        })
        .populate('senderId', 'name avatar _id')
        .populate('replyTo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments({
        conversationId: new Types.ObjectId(conversationId),
        isDeleted: false,
      }),
    ]);

    return {
      messages: messages.reverse(),
      total,
      hasMore: total > skip + messages.length,
    };
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        senderId:       { $ne: new Types.ObjectId(userId) },
        status:         { $ne: MessageStatus.READ },
      },
      {
        $set: { status: MessageStatus.READ },
        $push: {
          deliveryReceipts: {
            userId:    new Types.ObjectId(userId),
            status:    MessageStatus.READ,
            timestamp: new Date(),
          },
        },
      },
    );

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      $set: { [`readBy.${userId}`]: new Date() },
    });
  }

  async deleteMessage(
    messageId: string,
    userId:      string,
    forEveryone = false,
  ): Promise<void> {
    if (forEveryone) {
      const msg = await this.messageModel.findById(messageId);
      if (msg?.senderId.toString() !== userId)
        throw new ForbiddenException('Can only delete own messages');
      await this.messageModel.findByIdAndUpdate(messageId, {
        isDeleted:        true,
        content:          '',
        encryptedContent: '',
      });
    } else {
      await this.messageModel.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: new Types.ObjectId(userId) },
      });
    }
  }

  async editMessage(
    messageId: string,
    userId:    string,
    newContent: string,
  ): Promise<MessageDocument> {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId.toString() !== userId)
      throw new ForbiddenException('Can only edit own messages');

    return this.messageModel
      .findByIdAndUpdate(
        messageId,
        { content: newContent, isEdited: true },
        { new: true },
      )
      .populate('senderId', 'name avatar _id');
  }

  // Bug #4 fix: return updated message so gateway can emit full reactions array
  async addReaction(
    messageId: string,
    userId:    string,
    emoji:     string,
  ): Promise<MessageDocument> {
    await this.messageModel.findByIdAndUpdate(messageId, {
      $pull: { reactions: { userId: new Types.ObjectId(userId) } },
    });
    return this.messageModel
      .findByIdAndUpdate(
        messageId,
        {
          $push: {
            reactions: { userId: new Types.ObjectId(userId), emoji, createdAt: new Date() },
          },
        },
        { new: true },
      )
      .populate('senderId', 'name avatar _id');
  }

  async searchMessages(
    conversationId: string,
    query: string,
  ): Promise<MessageDocument[]> {
    return this.messageModel
      .find({
        conversationId: new Types.ObjectId(conversationId),
        content:        { $regex: query, $options: 'i' },
        isDeleted:      false,
      })
      .populate('senderId', 'name avatar _id')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  // ─── Helper: get all member userIds of a conversation ─────────────────────
  async getConversationMemberIds(conversationId: string): Promise<string[]> {
    const conv = await this.conversationModel
      .findById(conversationId)
      .select('members.userId')
      .lean();
    return (conv?.members || []).map((m) => m.userId.toString());
  }
}
