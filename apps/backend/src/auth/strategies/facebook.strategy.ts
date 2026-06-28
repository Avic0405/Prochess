import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('oauth.facebook.appId') ?? '',
      clientSecret: configService.get<string>('oauth.facebook.appSecret') ?? '',
      callbackURL: configService.get<string>('oauth.facebook.callbackUrl'),
      profileFields: ['id', 'emails', 'name', 'picture'],
      scope: ['email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: unknown) => void,
  ) {
    const { id, emails, name, photos } = profile;
    const email = emails?.[0]?.value ?? '';
    const displayName = `${name?.givenName ?? ''}${name?.familyName ?? ''}`;
    const avatar = photos?.[0]?.value ?? undefined;

    const user = await this.authService.findOrCreateOAuthUser({
      facebookId: id,
      email,
      username: displayName.replace(/\s/g, '').toLowerCase().slice(0, 20) || `user${id.slice(0, 8)}`,
      avatar,
    });

    done(null, user);
  }
}
