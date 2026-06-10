import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class AuthService {
  private apiKey = process.env.SHOPIFY_API_KEY ?? '';
  private apiSecret = process.env.SHOPIFY_API_SECRET ?? '';
  private appUrl = process.env.APP_URL ?? '';

  // Temporary in‑memory session store
  private sessions: Record<string, any> = {};

  // Step 1: Redirect merchant to Shopify install screen
  async beginAuth(req): Promise<string> {
    const shop = req.query.shop;

    if (!shop) {
      throw new Error('Missing shop parameter');
    }

    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `${this.appUrl}/auth/callback`;

    const installUrl =
      `https://${shop}/admin/oauth/authorize?` +
      `client_id=${this.apiKey}` +
      `&scope=read_products,write_products` +
      `&redirect_uri=${redirectUri}` +
      `&state=${state}`;

    // Save state for validation
    this.sessions[shop] = { state };

    return installUrl;
  }

  // Step 2: Handle callback from Shopify
  async finishAuth(req): Promise<void> {
    const { shop, code, state, hmac } = req.query;

    if (!shop || !code || !state || !hmac) {
      throw new Error('Missing required query parameters');
    }

    // Validate state
    if (!this.sessions[shop] || this.sessions[shop].state !== state) {
      throw new Error('Invalid state');
    }

    // Validate HMAC
    const params = { ...req.query };
    delete params['signature'];
    delete params['hmac'];

    const message = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const generatedHmac = crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');

    if (generatedHmac !== hmac) {
      throw new Error('HMAC validation failed');
    }

    // Exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;

    const response = await axios.post(tokenUrl, {
      client_id: this.apiKey,
      client_secret: this.apiSecret,
      code,
    });

    // Fix TypeScript "unknown" type
    const data: any = response.data;
    const accessToken = data.access_token;

    // Save session
    this.sessions[shop].accessToken = accessToken;

    console.log(`Shop ${shop} installed. Token saved.`);
  }
}
