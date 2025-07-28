// ES6 wrapper for JobClasses CommonJS module
import JobClassesModule from './JobClasses.js';

export const {
    JobClasses,
    JobRequirements,
    getJobInfo,
    canChangeJob,
    calculateStats,
    getSkillInfo,
    createSkillTypeMap
} = JobClassesModule; 