// ES6 wrapper for JobClasses CommonJS module
import * as JobClassesModule from './JobClasses.js';

export const {
    JobClasses,
    JobRequirements,
    getJobInfo,
    canChangeJob,
    calculateStats,
    getSkillInfo,
    createSkillTypeMap
} = JobClassesModule; 