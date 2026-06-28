import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookOAuthGuard extends AuthGuard('facebook') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const appId = this.configService.get<string>('oauth.facebook.appId') ?? '';
    if (!appId || appId.startsWith('placeholder') || appId === '') {
      const res = context.switchToHttp().getResponse();
      const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
      res.redirect(
        `${appUrl}/login?error=${encodeURIComponent('Facebook OAuth requires a real App ID. Add FACEBOOK_APP_ID to your .env file.')}`,
      );
      return false;
    }
    return super.canActivate(context);
  }
}
