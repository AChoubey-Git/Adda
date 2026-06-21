import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserStatus } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(data: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel(data);
    return user.save();
  }

  async findById(id: string): Promise<UserDocument> {
    // ✅ Include publicKey so E2E key exchange works
    return this.userModel
      .findById(id)
      .select('-password -refreshToken')
      .exec();
  }

  async findByIdWithRefreshToken(id: string): Promise<UserDocument> {
    return this.userModel.findById(id).select('+refreshToken').exec();
  }

  async findByEmail(email: string): Promise<UserDocument> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    const hashed = refreshToken ? await bcrypt.hash(refreshToken, 10) : null;
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: hashed });
  }

  // ✅ Upload user's ECDH public key (called after login/register)
  async updatePublicKey(userId: string, publicKey: string): Promise<UserDocument> {
    return this.userModel
      .findByIdAndUpdate(userId, { publicKey }, { new: true })
      .select('-password -refreshToken')
      .exec();
  }

  async updateStatus(userId: string, status: UserStatus): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      status,
      lastSeen: new Date(),
    });
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<UserDocument> {
    const allowed = ['name', 'bio', 'avatar'];
    const update: any = {};
    allowed.forEach((key) => { if (data[key] !== undefined) update[key] = data[key]; });
    return this.userModel
      .findByIdAndUpdate(userId, update, { new: true })
      .select('-password -refreshToken')
      .exec();
  }

  // ✅ Include publicKey in search results so sender can check if E2E is possible
  async searchUsers(query: string, currentUserId: string): Promise<UserDocument[]> {
    return this.userModel
      .find({
        $and: [
          { _id: { $ne: new Types.ObjectId(currentUserId) } },
          {
            $or: [
              { name:  { $regex: query, $options: 'i' } },
              { email: { $regex: query, $options: 'i' } },
            ],
          },
          { isActive: true },
        ],
      })
      .select('name email avatar status lastSeen publicKey')
      .limit(20)
      .exec();
  }

  async addContact(userId: string, contactId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { contacts: new Types.ObjectId(contactId) },
    });
  }

  async getContacts(userId: string): Promise<UserDocument[]> {
    const user = await this.userModel
      .findById(userId)
      .populate('contacts', 'name email avatar status lastSeen publicKey')
      .exec();
    return (user?.contacts as any) || [];
  }

  async blockUser(userId: string, targetId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: new Types.ObjectId(targetId) },
    });
  }

  async unblockUser(userId: string, targetId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { blockedUsers: new Types.ObjectId(targetId) },
    });
  }
}
