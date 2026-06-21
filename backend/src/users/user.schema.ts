import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: '' })
  bio: string;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.OFFLINE })
  status: UserStatus;

  @Prop({ default: Date.now })
  lastSeen: Date;

  @Prop({ select: false })
  refreshToken: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  // E2E encryption public key
  @Prop({ default: '' })
  publicKey: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  contacts: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  blockedUsers: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ name: 'text', email: 'text' });
