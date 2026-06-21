import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { MessageType } from './message.schema';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ─── Conversations ──────────────────────────────────────────────

  @Get('conversations')
  getConversations(@Request() req) {
    return this.chatService.getUserConversations(req.user.sub);
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string, @Request() req) {
    return this.chatService.getConversation(id, req.user.sub);
  }

  @Post('conversations/direct/:userId')
  createDirectConversation(@Param('userId') userId: string, @Request() req) {
    return this.chatService.getOrCreateDirectConversation(req.user.sub, userId);
  }

  @Post('conversations/group')
  createGroup(
    @Request() req,
    @Body('name') name: string,
    @Body('memberIds') memberIds: string[],
    @Body('description') description?: string,
  ) {
    return this.chatService.createGroupConversation(req.user.sub, name, memberIds, description);
  }

  @Post('conversations/:id/members/:memberId')
  addMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    return this.chatService.addGroupMember(id, req.user.sub, memberId);
  }

  @Delete('conversations/:id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    return this.chatService.removeGroupMember(id, req.user.sub, memberId);
  }

  @Patch('conversations/:id/promote/:memberId')
  promoteAdmin(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    return this.chatService.promoteToAdmin(id, req.user.sub, memberId);
  }

  // ─── Messages ───────────────────────────────────────────────────

  @Get('conversations/:id/messages')
  getMessages(
    @Param('id') id: string,
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.chatService.getMessages(id, req.user.sub, page, limit);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id') conversationId: string,
    @Request() req,
    @Body('content') content: string,
    @Body('type') type: MessageType,
    @Body('replyTo') replyTo?: string,
    @Body('encryptedContent') encryptedContent?: string,
  ) {
    return this.chatService.sendMessage(
      conversationId,
      req.user.sub,
      content,
      type || MessageType.TEXT,
      replyTo,
      undefined,
      encryptedContent,
    );
  }

  @Patch('conversations/:id/read')
  markAsRead(@Param('id') id: string, @Request() req) {
    return this.chatService.markMessagesAsRead(id, req.user.sub);
  }

  @Delete('messages/:id')
  deleteMessage(
    @Param('id') id: string,
    @Request() req,
    @Query('forEveryone') forEveryone: string,
  ) {
    return this.chatService.deleteMessage(id, req.user.sub, forEveryone === 'true');
  }

  @Patch('messages/:id')
  editMessage(
    @Param('id') id: string,
    @Request() req,
    @Body('content') content: string,
  ) {
    return this.chatService.editMessage(id, req.user.sub, content);
  }

  @Post('messages/:id/reactions')
  addReaction(
    @Param('id') id: string,
    @Request() req,
    @Body('emoji') emoji: string,
  ) {
    return this.chatService.addReaction(id, req.user.sub, emoji);
  }

  @Get('conversations/:id/search')
  searchMessages(
    @Param('id') id: string,
    @Query('q') query: string,
  ) {
    return this.chatService.searchMessages(id, query);
  }
}
