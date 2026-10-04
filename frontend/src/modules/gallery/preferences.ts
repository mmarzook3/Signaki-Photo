import { create } from "zustand";
interface Preferences {
  rooms: Record<string, string[]>;
  toggle: (property: string, room: string) => void;
}
export const useGalleryPreferences = create<Preferences>((set) => ({
  rooms: {},
  toggle: (property, room) =>
    set((s) => {
      const rooms = s.rooms[property] || [];
      return {
        rooms: {
          ...s.rooms,
          [property]: rooms.includes(room)
            ? rooms.filter((r) => r !== room)
            : [...rooms, room],
        },
      };
    }),
}));
