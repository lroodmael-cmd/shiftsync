import { describe, it, expect } from 'vitest';
import { overlaps, validateShift, type Shift } from './shifts';
const make = (id: string, startAt: string, endAt: string): Shift => ({id,title:'Work',color:'#5b8cff',startAt,endAt});
describe('shifts',()=>{
 it('detects overlapping night shifts',()=>expect(overlaps(make('1','2026-10-21T22:00:00-04:00','2026-10-22T06:30:00-04:00'),make('2','2026-10-22T05:00:00-04:00','2026-10-22T10:00:00-04:00'))).toBe(true));
 it('allows touching shifts',()=>expect(overlaps(make('1','2026-10-21T10:00:00-04:00','2026-10-21T12:00:00-04:00'),make('2','2026-10-21T12:00:00-04:00','2026-10-21T14:00:00-04:00'))).toBe(false));
 it('rejects reversed intervals',()=>expect(validateShift({title:'A',startAt:'2026-10-21T12:00',endAt:'2026-10-21T11:00'})).not.toBeNull());
});
