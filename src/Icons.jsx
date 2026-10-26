const S = (extra = {}) => ({ fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', ...extra });

export const Close = () => <svg width="20" height="20" viewBox="0 0 24 24" style={S()}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const Prev = () => <svg width="22" height="22" viewBox="0 0 24 24" style={S()}><path d="M19 20 9 12l10-8v16zM5 19V5" /></svg>;
export const Next = () => <svg width="22" height="22" viewBox="0 0 24 24" style={S()}><path d="m5 4 10 8-10 8V4zM19 5v14" /></svg>;
export const Back = () => <svg width="20" height="20" viewBox="0 0 24 24" style={S()}><path d="m15 18-6-6 6-6" /></svg>;
export const Chevron = () => <svg width="20" height="20" viewBox="0 0 24 24" style={S({ stroke: 'var(--color-accent)' })}><path d="m9 18 6-6-6-6" /></svg>;
export const Play = () => <svg width="18" height="18" viewBox="0 0 24 24" style={S({ strokeLinecap: 'butt' })}><path d="M6 3l14 9-14 9V3z" /></svg>;
export const Stopwatch = () => <svg width="18" height="18" viewBox="0 0 24 24" style={S({ strokeLinecap: 'butt' })}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M10 2h4" /></svg>;
export const Upload = () => <svg width="18" height="18" viewBox="0 0 24 24" style={S()}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>;
export const Search = () => <svg width="18" height="18" viewBox="0 0 24 24" style={{ position: 'absolute', left: 12, top: 13, fill: 'none', stroke: 'var(--color-neutral-600)', strokeWidth: 1.5, strokeLinecap: 'round' }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
export const Up = () => <svg width="18" height="18" viewBox="0 0 24 24" style={S()}><path d="m18 15-6-6-6 6" /></svg>;
export const Down = () => <svg width="18" height="18" viewBox="0 0 24 24" style={S()}><path d="m6 9 6 6 6-6" /></svg>;
export const Check = () => <svg width="14" height="14" viewBox="0 0 24 24" style={S({ strokeWidth: 2 })}><path d="M20 6 9 17l-5-5" /></svg>;
export const TabToday = () => <svg width="22" height="22" viewBox="0 0 24 24" style={S({ strokeLinejoin: 'miter' })}><rect x="3" y="4" width="18" height="18" rx="1" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
export const TabList = () => <svg width="22" height="22" viewBox="0 0 24 24" style={S({ strokeLinejoin: 'miter' })}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
export const TabLib = () => <svg width="22" height="22" viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;

export const Corners = ({ color }) => ['tl', 'tr', 'bl', 'br'].map(c => <i key={c} className={'corner ' + c} style={color ? { color } : undefined} />);
