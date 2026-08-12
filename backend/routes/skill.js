const express = require('express');
const router = express.Router();
const { AppDataSource } = require('../utils/dataSource');
const Skill = require('../entities/Skill');
const { sendSuccess, sendFailed } = require('../utils/responseFormat');
const { isValidString, isValidUUID } = require('../utils/validations');

// 新增教練技能的 API
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!isValidString(name, 50)) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }
    const skillRepo = AppDataSource.getRepository(Skill);

    // 先去資料庫找找看是不是已經有這個技能了
    const existingSkill = await skillRepo.findOne({ where: { name } });
    if (existingSkill) {
      return sendFailed(res, 409, '資料重複');
    }

    // 確定沒有重複就把它存進去
    const newSkill = skillRepo.create({ name });
    await skillRepo.save(newSkill);

    return sendSuccess(res, 201, {
      id: newSkill.id,
      name: newSkill.name,
    });
  } catch (error) {
    next(error);
  }
});

// 取得所有技能列表
router.get('/', async (req, res, next) => {
  try {
    const skillRepo = AppDataSource.getRepository(Skill);
    const skills = await skillRepo.find();
    
    // 把資料整理成前端要的長相
    const data = skills.map(skill => ({
      id: skill.id,
      name: skill.name,
    }));

    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

// 刪除某個不需要的技能
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return sendFailed(res, 400, '欄位驗證失敗'); // 測試檔說如果 id 亂寫要回傳 400 Failed
    }

    const skillRepo = AppDataSource.getRepository(Skill);
    const existingSkill = await skillRepo.findOne({ where: { id } });

    if (!existingSkill) {
      // 如果資料庫根本找不到這個 id，也要回報錯誤給前端
      return sendFailed(res, 400, '查無此技能'); // 看測試檔寫的，這裡要失敗
    }

    await skillRepo.delete(id);
    return sendSuccess(res, 200);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
