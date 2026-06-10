import { Controller, Get, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('install')
  async install(@Req() req, @Res() res) {
    const redirectUrl = await this.authService.beginAuth(req);
    return res.redirect(redirectUrl);
  }

  @Get('callback')
  async callback(@Req() req, @Res() res) {
    await this.authService.finishAuth(req);
    return res.send('App installed successfully');
  }
}
