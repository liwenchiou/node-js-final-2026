const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Coach',
  tableName: 'COACH',
  columns: {
    id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid',
    },
    experience_years: {
      type: 'integer',
      nullable: true,
    },
    description: {
      type: 'text',
      nullable: true,
    },
    profile_image_url: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    created_at: {
      type: 'timestamp',
      createDate: true,
      nullable: false,
    },
    updated_at: {
      type: 'timestamp',
      updateDate: true,
      nullable: false,
    },
  },
  relations: {
    user: {
      target: 'User',
      type: 'one-to-one',
      joinColumn: {
        name: 'user_id',
      },
      onDelete: 'CASCADE',
    },
    skills: {
      target: 'Skill',
      type: 'many-to-many',
      joinTable: {
        name: 'COACH_LINK_SKILL',
        joinColumn: {
          name: 'coach_id',
          referencedColumnName: 'id',
        },
        inverseJoinColumn: {
          name: 'skill_id',
          referencedColumnName: 'id',
        },
      },
    },
  },
});
