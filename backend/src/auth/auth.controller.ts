import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService }      from './auth.service';
import { LocalAuthGuard }   from './guards/local-auth.guard';
import { JwtAuthGuard }     from './guards/jwt-auth.guard';
import { JwtRefreshGuard }  from './guards/jwt-refresh.guard';
import { RegisterDto }      from './dto/register.dto';
import { LoginDto }         from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req, @Body() _loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    return this.authService.logout(req.user.sub);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req) {
    return this.authService.refreshTokens(req.user.sub, req.user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return req.user;
  }

  // ✅ Upload ECDH public key — called by client right after login/register
  @UseGuards(JwtAuthGuard)
  @Post('public-key')
  @HttpCode(HttpStatus.OK)
  async uploadPublicKey(
    @Request() req,
    @Body('publicKey') publicKey: string,
  ) {
    if (!publicKey) return { message: 'publicKey required' };
    return this.authService.updatePublicKey(req.user.sub, publicKey);
  }

  // Health check endpoint for Docker
  @Get('health')
  health() {
    return { status: 'ok', service: 'adda-backend' };
  }
}
