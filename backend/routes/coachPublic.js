const express = require('express');
const router = express.Router();
const { AppDataSource } = require('../utils/dataSource');
const Coach = require('../entities/Coach');
const Course = require('../entities/Course');
const { sendSuccess, sendFailed } = require('../utils/responseFormat');
const { isValidUUID } = require('../utils/validations');

// GET /api/coaches
router.get('/', async (req, res, next) => {
  try {
    const { per, page } = req.query;
    
    // per 與 page 必填驗證
    if (!per || !page) {
      return sendFailed(res, 400, '缺少必填參數');
    }
    
    const perNum = parseInt(per, 10);
    const pageNum = parseInt(page, 10);
    
    if (isNaN(perNum) || isNaN(pageNum)) {
      return sendFailed(res, 400, '參數格式錯誤');
    }
    
    const take = perNum;
    const skip = (pageNum - 1) * perNum;
    
    const coachRepo = AppDataSource.getRepository(Coach);
    const coaches = await coachRepo.find({
      relations: { user: true },
      take,
      skip,
    });
    
    const data = coaches.map(coach => ({
      id: coach.id,
      user_id: coach.user ? coach.user.id : null,
      name: coach.user ? coach.user.name : null,
    }));
    
    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

// GET /api/coaches/:coachId
router.get('/:coachId', async (req, res, next) => {
  try {
    const { coachId } = req.params;
    
    // 驗證 uuid
    if (!isValidUUID(coachId)) {
      return sendFailed(res, 400, '參數格式錯誤');
    }
    
    const coachRepo = AppDataSource.getRepository(Coach);
    const coach = await coachRepo.findOne({
      where: { id: coachId },
      relations: { user: true, skills: true },
    });
    
    if (!coach) {
      return sendFailed(res, 404, '找不到該教練');
    }
    
    return sendSuccess(res, 200, {
      user: {
        name: coach.user ? coach.user.name : null,
      },
      coach: {
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        skills: coach.skills ? coach.skills.map(skill => ({
          id: skill.id,
          name: skill.name,
        })) : [],
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/coaches/:coachId/courses
router.get('/:coachId/courses', async (req, res, next) => {
  try {
    const { coachId } = req.params;
    
    const coachRepo = AppDataSource.getRepository(Coach);
    const coach = await coachRepo.findOne({
      where: { id: coachId },
      relations: { user: true },
    });
    
    if (!coach) {
      return sendFailed(res, 404, '找不到該教練');
    }
    
    const courseRepo = AppDataSource.getRepository(Course);
    const { MoreThan } = require('typeorm');
    
    const now = new Date();
    const courses = await courseRepo.find({
      where: {
        user: { id: coach.user.id },
        end_at: MoreThan(now),
      },
      relations: { skill: true, user: true },
      order: { start_at: 'ASC' }, // 或其他排序
    });
    
    const data = courses.map(course => ({
      id: course.id,
      name: course.name,
      coach_name: course.user ? course.user.name : null,
      skill_name: course.skill ? course.skill.name : null,
      max_participants: course.max_participants,
      start_at: course.start_at,
      end_at: course.end_at,
    }));
    
    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
