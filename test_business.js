const { getRoleLabel, isAdminRole } = require('./admin_portal/src/lib/business-types.ts');
console.log(getRoleLabel(undefined));
console.log(isAdminRole(undefined));
