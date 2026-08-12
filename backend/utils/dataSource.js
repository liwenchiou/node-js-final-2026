const { DataSource } = require('typeorm');
require('dotenv').config();

const User = require('../entities/User');
const Coach = require('../entities/Coach');
const Skill = require('../entities/Skill');
const CreditPackage = require('../entities/CreditPackage');
const CreditPurchase = require('../entities/CreditPurchase');
const Course = require('../entities/Course');
const CourseBooking = require('../entities/CourseBooking');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'student',
  password: process.env.DB_PASSWORD || 'student666',
  database: process.env.DB_DATABASE || 'fitness',
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: false,
  ssl: process.env.DB_ENABLE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [
    User,
    Coach,
    Skill,
    CreditPackage,
    CreditPurchase,
    Course,
    CourseBooking
  ],
  subscribers: [],
  migrations: [],
});

module.exports = {
  AppDataSource
};
