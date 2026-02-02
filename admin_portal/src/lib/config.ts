// Super Admin whitelist - these emails have super admin access
export const SUPER_ADMIN_EMAILS: string[] = [
    'metin.oez@icloud.com',
    'metin.oez@gmail.com',
    // Add other super admin emails here
];

// Check if email is a super admin
export const isSuperAdmin = (email: string | null): boolean => {
    if (!email) return false;
    return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
};
