import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const clientId = this.configService.get<string>('oauth.google.clientId') ?? '';
    if (!clientId || clientId.startsWith('placeholder') || clientId === '') {
      const res = context.switchToHttp().getResponse();
      const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
      res.redirect(
        `${appUrl}/login?error=${encodeURIComponent('Google OAuth requires a real Client ID. Add GOOGLE_CLIENT_ID to your .env file.')}`,
      );
      return false;
    }
    return super.canActivate(context);
  }
}
