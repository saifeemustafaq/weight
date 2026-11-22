export type Member = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type WeighIn = {
  id: string;
  personId: string;
  weight: number;
  dayKey: string;
  recordedAt: string;
};

export type Board = {
  today: string;
  timezone: string;
  unit: "lb";
  members: Member[];
  entries: WeighIn[];
};
