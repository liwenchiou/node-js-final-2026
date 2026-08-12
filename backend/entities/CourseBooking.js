const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'CourseBooking',
  tableName: 'COURSE_BOOKING',
  columns: {
    id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid',
    },
    booking_at: {
      type: 'timestamp',
      createDate: true,
      nullable: false,
    },
    join_at: {
      type: 'timestamp',
      nullable: true,
    },
    leave_at: {
      type: 'timestamp',
      nullable: true,
    },
    cancelled_at: {
      type: 'timestamp',
      nullable: true, // 用來做 soft delete 的標記
    },
    created_at: {
      type: 'timestamp',
      createDate: true,
      nullable: false,
    },
  },
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: {
        name: 'user_id',
      },
    },
    course: {
      target: 'Course',
      type: 'many-to-one',
      joinColumn: {
        name: 'course_id',
      },
    },
  },
});
