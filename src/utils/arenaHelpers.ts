// Shared arena helper constants and functions

export const AVAILABLE_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'Dark', hex: '#18181b' },
];

export const TOP_100_BABY_NAMES = [
  'Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Charlotte', 'James', 'Amelia',
  'Elijah', 'Sophia', 'William', 'Isabella', 'Henry', 'Ava', 'Lucas', 'Mia',
  'Benjamin', 'Evelyn', 'Theodore', 'Harper', 'Mateo', 'Luna', 'Levi', 'Camila',
  'Sebastian', 'Gianna', 'Daniel', 'Elizabeth', 'Jack', 'Eleanor', 'Michael', 'Ella',
  'Alexander', 'Emily', 'Owen', 'Sofia', 'Asher', 'Avery', 'Samuel', 'Mila',
  'Ethan', 'Aria', 'Leo', 'Chloe', 'Jackson', 'Layla', 'Mason', 'Penelope',
  'Ezra', 'Riley', 'John', 'Zoey', 'Hudson', 'Nora', 'Luca', 'Lily',
  'Aiden', 'Grace', 'David', 'Hannah', 'Joseph', 'Lillian', 'Wyatt', 'Addison',
  'Matthew', 'Aubrey', 'Luke', 'Ellie', 'Julian', 'Stella', 'Isaac', 'Natalie',
  'Jayden', 'Zoe', 'Maverick', 'Leah', 'Josiah', 'Hazel', 'Lincoln', 'Violet',
  'Thomas', 'Aurora', 'Caleb', 'Savannah', 'Christopher', 'Audrey', 'Miles', 'Brooklyn',
  'Logan', 'Bella', 'Gabriel', 'Claire', 'Anthony', 'Skylar', 'Dylan', 'Paisley',
  'Christian', 'Everly', 'Andrew', 'Anna',
];

/** Generate five random names from the TOP_100_BABY_NAMES list */
export const generate5Names = (): string[] => {
  const shuffled = [...TOP_100_BABY_NAMES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 5);
};
