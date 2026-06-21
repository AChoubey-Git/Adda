import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  SYSTEM = 'system',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export interface MediaAttachment {
  url: string;
  type: string;
  size: number;
  name: string;
  thumbnailUrl?: string;
  duration?: number; // for audio/video
  width?: number;   // for images/videos
  height?: number;
}

export interface ReactionEntry {
  userId: Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ default: '' })
  content: string;

  // Encrypted content (for E2E)
  @Prop({ default: '' })
  encryptedContent: string;

  @Prop({ type: Object })
  media: MediaAttachment;

  @Prop({ type: String, enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        status: { type: String, enum: MessageStatus },
        timestamp: { type: Date },
      },
    ],
    default: [],
  })
  deliveryReceipts: Array<{
    userId: Types.ObjectId;
    status: MessageStatus;
    timestamp: Date;
  }>;

  // Reply to another message
  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo: Types.ObjectId;

  // Reactions
  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        emoji: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  reactions: ReactionEntry[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  deletedFor: Types.ObjectId[];

  @Prop({ default: false })
  isEdited: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: false })
  isForwarded: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ status: 1 });
MessageSchema.index({ content: 'text' });
