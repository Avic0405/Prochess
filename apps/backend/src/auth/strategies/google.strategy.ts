import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('oauth.google.clientId') ?? '',
      clientSecret: configService.get<string>('oauth.google.clientSecret') ?? '',
      callbackURL: configService.get<string>('oauth.google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { id, emails, photos, displayName } = profile;
    const email = emails?.[0]?.value ?? '';
    const avatar = photos?.[0]?.value ?? undefined;

    const user = await this.authService.findOrCreateOAuthUser({
      googleId: id,
      email,
      username: displayName.replace(/\s/g, '').toLowerCase().slice(0, 20),
      avatar,
    });

    done(null, user);
  }
}
