// Set test env BEFORE any module imports
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'file:./test.db';
process.env['JWT_ACCESS_SECRET'] = 'test_access_secret_for_jest_32chars!!';
process.env['JWT_REFRESH_SECRET'] = 'test_refresh_secret_for_jest_32chars!';
process.env['JWT_ACCESS_EXPIRY'] = '15m';
process.env['JWT_REFRESH_EXPIRY'] = '7d';
process.env['BCRYPT_ROUNDS'] = '4';
process.env['PORT'] = '3001';
process.env['CORS_ORIGIN'] = '*';
process.env['RATE_LIMIT_WINDOW_MS'] = '900000';
process.env['RATE_LIMIT_MAX'] = '100';
process.env['AUTH_RATE_LIMIT_MAX'] = '10';
