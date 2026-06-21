import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
}

export interface GroupMember {
  userId: Types.ObjectId;
  role: 'admin' | 'member';
  joinedAt: Date;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: String, enum: ConversationType, default: ConversationType.DIRECT })
  type: ConversationType;

  // For group chats
  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['admin', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  members: GroupMember[];

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessage: Types.ObjectId;

  @Prop({ default: Date.now })
  lastActivity: Date;

  @Prop({
    type: Map,
    of: Date,
    default: {},
  })
  readBy: Map<string, Date>;

  @Prop({ default: true })
  isActive: boolean;

  // E2E encryption: per-conversation key (encrypted per member)
  @Prop({ type: Map, of: String, default: {} })
  encryptedKeys: Map<string, string>;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes
ConversationSchema.index({ 'members.userId': 1 });
ConversationSchema.index({ lastActivity: -1 });
ConversationSchema.index({ type: 1 });
