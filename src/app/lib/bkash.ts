import config from "../config";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
  try {
    const IdTokenKey = "bkash:idToken";
    const refreshTokenKey = "bkash:refreshToken";

    let bkashIdToken = await redisClient.get(IdTokenKey);
    const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey);

    let bkashRefreshToken = await redisClient.get(refreshTokenKey);
    const bkashRefreshTokenTTL = await redisClient.ttl(refreshTokenKey);

    if (
      (bkashIdTokenTTL <= 600 || !bkashIdToken) &&
      bkashRefreshToken &&
      bkashRefreshTokenTTL > 600
    ) {
      const refreshTokenResponse = await fetch(
        `${config.bkash_base_url}/tokenized/checkout/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ACCEPT: "application/json",
            username: config.bkash_username,
            password: config.bkash_password,
          },
          body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret,
            refresh_token: bkashRefreshToken,
          }),
        },
      );

      if (!refreshTokenResponse.ok) {
        throw new Error(`Failed to refresh Bkash ID token`);
      }

      const refreshTokenResult = await refreshTokenResponse.json();

      await redisClient.set(IdTokenKey, refreshTokenResult.id_token, {
        expiration: {
          type: "EX",
          value: 3600, // Expiration time in seconds
        },
      });

      bkashIdToken = refreshTokenResult.id_token;

      return bkashIdToken;
    }

    if (bkashIdTokenTTL > 600) {
      return bkashIdToken;
    }

    const response = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ACCEPT: "application/json",
          username: config.bkash_username,
          password: config.bkash_password,
        },
        body: JSON.stringify({
          app_key: config.bkash_app_key,
          app_secret: config.bkash_app_secret,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get Bkash ID token`);
    }

    const result = await response.json();

    await redisClient.set(IdTokenKey, result.id_token, {
      expiration: {
        type: "EX",
        value: 3600, // Expiration time in seconds
      },
    });

    await redisClient.set(refreshTokenKey, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 28 * 24 * 3600, // Expiration time in seconds (28 days)
      },
    });

    bkashIdToken = result.id_token;

    return bkashIdToken;
  } catch (error) {
    throw new Error(`Error in getBkashIdToken: ${error}`);
  }
};
