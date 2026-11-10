export const canReviewCommunityIntake = (actor) => actor.roles.some((r) => r === 'owner' || r === 'administrator' || r === 'reviewer');
