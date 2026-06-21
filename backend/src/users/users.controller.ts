import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  search(@Query('q') query: string, @Request() req) {
    return this.usersService.searchUsers(query, req.user.sub);
  }

  @Get('contacts')
  getContacts(@Request() req) {
    return this.usersService.getContacts(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('profile')
  updateProfile(@Request() req, @Body() body: any) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Post('contacts/:contactId')
  addContact(@Request() req, @Param('contactId') contactId: string) {
    return this.usersService.addContact(req.user.sub, contactId);
  }

  @Post('block/:targetId')
  blockUser(@Request() req, @Param('targetId') targetId: string) {
    return this.usersService.blockUser(req.user.sub, targetId);
  }

  @Delete('block/:targetId')
  unblockUser(@Request() req, @Param('targetId') targetId: string) {
    return this.usersService.unblockUser(req.user.sub, targetId);
  }
}
