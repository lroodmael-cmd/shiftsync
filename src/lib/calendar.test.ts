import { describe, it, expect } from 'vitest';
import { addDays, daySegments, startOfWeek } from './calendar';
import { decodeShifts } from './storage';
const shift = {id:'1',title:'Night',color:'#5b8cff',startAt:new Date(2026,9,21,22).toISOString(),endAt:new Date(2026,9,22,6).toISOString()};
describe('weekly calendar',()=>{
 it('starts on Monday even for Sunday',()=>expect(startOfWeek(new Date(2026,9,25)).getDate()).toBe(19));
 it('splits night work at local midnight',()=>{
 const first=daySegments([shift],new Date(2026,9,21))[0];
 const second=daySegments([shift],new Date(2026,9,22))[0];
 expect(first.top).toBeCloseTo(22/24*100); expect(first.height).toBeCloseTo(2/24*100);
 expect(second.top).toBe(0); expect(second.height).toBe(25);
 });
 it('excludes a shift ending at the day boundary',()=>expect(daySegments([shift],new Date(2026,9,23))).toHaveLength(0));
 it('navigates across years',()=>expect(addDays(new Date(2026,11,28),7).getFullYear()).toBe(2027));
});
describe('local storage',()=>{
 it('round-trips shifts and edits',()=>expect(decodeShifts(JSON.stringify([{...shift,title:'Updated'}]))[0].title).toBe('Updated'));
 it('round-trips deletion',()=>expect(decodeShifts('[]')).toEqual([]));
 it.each(['broken','{}','[{}]',JSON.stringify([{...shift,title:null}]),JSON.stringify([shift,shift])])('rejects malformed saved data %s',raw=>expect(()=>decodeShifts(raw)).toThrow());
 it('loads an empty new schedule',()=>expect(decodeShifts(null)).toEqual([]));
});
