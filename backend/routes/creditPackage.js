const express = require('express');
const router = express.Router();
const { AppDataSource } = require('../utils/dataSource');
const CreditPackage = require('../entities/CreditPackage');
const { sendSuccess, sendFailed } = require('../utils/responseFormat');
const { isValidString, isValidUUID } = require('../utils/validations');

// 新增購買方案的 API
router.post('/', async (req, res, next) => {
  try {
    const { name, credit_amount, price } = req.body;

    if (
      !isValidString(name, 50) ||
      typeof credit_amount !== 'number' || credit_amount <= 0 || !Number.isInteger(credit_amount) ||
      typeof price !== 'number' || price <= 0
    ) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }
    const repo = AppDataSource.getRepository(CreditPackage);

    // 先確認資料庫有沒有同名的方案，免得重複新增
    const existing = await repo.findOne({ where: { name } });
    if (existing) {
      return sendFailed(res, 409, '資料重複');
    }

    // 沒問題就存進資料庫
    const newPackage = repo.create({ name, credit_amount, price });
    await repo.save(newPackage);

    return sendSuccess(res, 201, {
      id: newPackage.id,
      name: newPackage.name,
      credit_amount: newPackage.credit_amount,
      price: newPackage.price,
    });
  } catch (error) {
    next(error);
  }
});

// 取得所有方案列表
router.get('/', async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(CreditPackage);
    const packages = await repo.find();
    
    // 把撈出來的資料稍微整理一下，轉成前端需要的格式
    const data = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      credit_amount: pkg.credit_amount,
      price: pkg.price,
    }));

    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

// 刪除用不到的方案
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }

    const repo = AppDataSource.getRepository(CreditPackage);
    const existing = await repo.findOne({ where: { id } });

    if (!existing) {
      return sendFailed(res, 400, '查無此方案');
    }

    await repo.delete(id);
    return sendSuccess(res, 200);
  } catch (error) {
    next(error);
  }
});

const { verifyToken } = require('../utils/auth');
const CreditPurchase = require('../entities/CreditPurchase');

// 會員購買方案 (記得加上 verifyToken 來確認是誰買的)
router.post('/:packageId', verifyToken, async (req, res, next) => {
  try {
    const { packageId } = req.params;
    
    if (!isValidUUID(packageId)) {
      return sendFailed(res, 400, '參數格式錯誤');
    }
    
    const packageRepo = AppDataSource.getRepository(CreditPackage);
    const pkg = await packageRepo.findOne({ where: { id: packageId } });
    
    if (!pkg) {
      return sendFailed(res, 400, '查無此方案');
    }
    
    const purchaseRepo = AppDataSource.getRepository(CreditPurchase);
    const newPurchase = purchaseRepo.create({
      user: req.user,
      creditPackage: pkg,
      purchased_credits: pkg.credit_amount,
      price_paid: pkg.price,
    });
    
    await purchaseRepo.save(newPurchase);
    
    return sendSuccess(res, 201, {
      id: newPurchase.id,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
