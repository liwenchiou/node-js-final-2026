const jwt = require('jsonwebtoken');
const { sendFailed } = require('./responseFormat');
const { AppDataSource } = require('./dataSource');
const User = require('../entities/User');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: process.env.JWT_EXPIRES_DAY || '30d',
  });
};

const verifyToken = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendFailed(res, 401, '請先登入');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // 驗證 user 是否存在
    const userRepo = AppDataSource.getRepository(User);
    const currentUser = await userRepo.findOne({ where: { id: decoded.id } });

    if (!currentUser) {
      return sendFailed(res, 401, '無效的 token，使用者不存在');
    }

    // 將 user 資訊附加到 req 上供後續 route 使用
    req.user = currentUser;
    next();
  } catch (error) {
    return sendFailed(res, 401, '請先登入');
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
