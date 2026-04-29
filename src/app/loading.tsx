import { Logo } from '@/components/shared/logo';

export default function RootLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 24, background: '#FAF9F7',
    }}>
      <Logo size={40} wordmarkSize={26} />
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2.5px solid #E8DED5',
        borderTopColor: '#C96442',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
