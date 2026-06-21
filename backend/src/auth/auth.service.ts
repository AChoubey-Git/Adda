import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService }      from '@nestjs/jwt';
import { ConfigService }   from '@nestjs/config';
import * as bcrypt         from 'bcryptjs';
import { UsersService }    from '../users/users.service';
import { RegisterDto }     from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService:   UsersService,
    private readonly jwtService:     JwtService,
    private readonly configService:  ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const { password: _, ...result } = user.toObject();
    return result;
  }

  async register(registerDto: RegisterDto) {
    const existing = await this.usersService.findByEmail(registerDto.email);
    if (existing) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const tokens = await this.generateTokens(user._id.toString(), user.email);
    await this.usersService.updateRefreshToken(user._id.toString(), tokens.refreshToken);

    // Return user without password/refreshToken
    const safeUser = {
      _id:       user._id,
      name:      user.name,
      email:     user.email,
      avatar:    user.avatar,
      bio:       user.bio,
      status:    user.status,
      publicKey: user.publicKey,
      createdAt: user.createdAt,
    };

    return { user: safeUser, ...tokens };
  }

  async login(user: any) {
    const tokens = await this.generateTokens(user._id.toString(), user.email);
    await this.usersService.updateRefreshToken(user._id.toString(), tokens.refreshToken);

    const safeUser = {
      _id:       user._id,
      name:      user.name,
      email:     user.email,
      avatar:    user.avatar,
      bio:       user.bio,
      status:    user.status,
      publicKey: user.publicKey,
      createdAt: user.createdAt,
    };

    return { user: safeUser, ...tokens };
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findByIdWithRefreshToken(userId);
    if (!user || !user.refreshToken) throw new UnauthorizedException('Access denied');

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) throw new UnauthorizedException('Access denied');

    const tokens = await this.generateTokens(user._id.toString(), user.email);
    await this.usersService.updateRefreshToken(user._id.toString(), tokens.refreshToken);
    return tokens;
  }

  // ✅ Called by client after login/register to store their ECDH public key
  async updatePublicKey(userId: string, publicKey: string) {
    return this.usersService.updatePublicKey(userId, publicKey);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:    this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret:    this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
