'use client';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Moon, Sun, Plus, Trash2, Pencil } from 'lucide-react';
import { conflicts, validateShift, type Shift } from '@/lib/shifts';
const KEY = 'shiftsync:v1:shifts';
const THEME = 'shiftsync:v1:theme';
const local = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
const display = (iso:string) => new Date(iso).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const blank = () => { const start=new Date(); start.setMinutes(0,0,0); const end=new Date(start.getTime()+8*3600000); return {title:'Work shift',start:local(start),end:local(end),color:'#5b8cff'}; };
export default function Home(){
 const [shifts,setShifts]=useState<Shift[]>([]);
 const [ready,setReady]=useState(false);
 const [theme,setTheme]=useState<'light'|'dark'>('dark');
 const [form,setForm]=useState(blank);
 const [editing,setEditing]=useState<string|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(stored))setShifts(stored.filter(x=>x&&typeof x.id==='string'&&typeof x.startAt==='string'&&typeof x.endAt==='string'));}catch{}const saved=localStorage.getItem(THEME);setTheme(saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));setReady(true);},[]);
 useEffect(()=>{if(ready)localStorage.setItem(KEY,JSON.stringify(shifts));},[ready,shifts]);
 useEffect(()=>{if(ready)localStorage.setItem(THEME,theme);},[ready,theme]);
 const sorted=useMemo(()=>[...shifts].sort((a,b)=>a.startAt.localeCompare(b.startAt)),[shifts]);
 const issueCount=useMemo(()=>sorted.filter((s,i)=>sorted.some((other,j)=>j<i&&conflicts([other],s).length>0)).length,[sorted]);
 function save(e:React.FormEvent){e.preventDefault();const draft={id:editing||crypto.randomUUID(),title:form.title.trim(),startAt:new Date(form.start).toISOString(),endAt:new Date(form.end).toISOString(),color:form.color};const problem=validateShift(draft);if(problem){setError(problem);return;}setShifts(prev=>editing?prev.map(s=>s.id===editing?draft:s):[...prev,draft]);setEditing(null);setForm(blank());setError('');}
 function edit(s:Shift){setEditing(s.id);setForm({title:s.title,start:local(new Date(s.startAt)),end:local(new Date(s.endAt)),color:s.color});setError('');}
 return <main data-theme={theme} className="shell"><div className="container">
 <header><div className="brand"><span className="logo"><CalendarDays size={21}/></span><div><strong>ShiftSync</strong><small>YOUR TIME, IN SYNC.</small></div></div><button className="iconbutton" aria-label="Toggle theme" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun/>:<Moon/>}</button></header>
 <div className="layout"><aside className="sidebar"><div className="navitem selected"><CalendarDays size={18}/> Schedule</div><p className="hint">Sprint 01 · Local-first prototype</p></aside><section className="content"><div className="intro"><div><p className="eyebrow">MY WORKSPACE</p><h1>Your schedule</h1><p className="sub">Plan your shifts, even across midnight.</p></div><span className="pill">{shifts.length} shifts</span></div>
 <div className="stats"><article className="stat"><small>Scheduled shifts</small><strong>{shifts.length}</strong></article><article className="stat"><small>Overlap warnings</small><strong>{issueCount}</strong></article></div>
 <section className="panel"><h2>Upcoming shifts</h2>{!ready?<p className="sub">Loading...</p>:sorted.length===0?<div className="empty"><CalendarDays size={30}/><h3>No shifts yet</h3><p>Add your first shift using the form.</p></div>:<div className="shiftlist">{sorted.map(s=><div className="shift" key={s.id}><span className="color" style={{background:s.color}}/><div className="shiftbody"><strong>{s.title}</strong><small>{display(s.startAt)} → {display(s.endAt)}</small>{conflicts(sorted,s).length>0&&<span className="warning">Overlaps another shift</span>}</div><button className="iconbutton" onClick={()=>edit(s)} aria-label={`Edit ${s.title}`}><Pencil size={17}/></button><button className="iconbutton" onClick={()=>{if(window.confirm(`Delete ${s.title}?`)){setShifts(prev=>prev.filter(x=>x.id!==s.id));if(editing===s.id){setEditing(null);setForm(blank());}}}} aria-label={`Delete ${s.title}`}><Trash2 size={17}/></button></div>)}</div>}</section>
 </section><aside className="editor panel"><h2>{editing?'Edit shift':'New shift'}</h2><p className="sub">Set a start and end date to support overnight work.</p><form onSubmit={save}><label>Shift name<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Starts<input required type="datetime-local" value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></label><label>Ends<input required type="datetime-local" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></label><label>Color<input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/></label>{error&&<p role="alert" className="warning">{error}</p>}<button className="primary" type="submit"><Plus size={17}/>{editing?'Save changes':'Add shift'}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(null);setForm(blank());setError('')}}>Cancel editing</button>}</form></aside></div>
 <footer>Local-only demo · No account required · Your data stays in this browser</footer>
 </div></main>;
}
