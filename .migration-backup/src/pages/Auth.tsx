import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      if (login(email, password)) {
        navigate('/');
        window.location.reload();
      } else {
        setError('Invalid email or password');
      }
    } else {
      if (!name || !email || !phone || !password) {
        setError('All fields are required');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (register(name, email, phone, password)) {
        navigate('/');
        window.location.reload();
      } else {
        setError('Registration failed');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Plane className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            pantane<span className="text-primary">Ax</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Crash game demo platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 rounded-xl border border-border bg-card">
          <h2 className="text-lg font-semibold text-center">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" className="bg-muted" />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="bg-muted" />
          </div>

          <Button type="submit" className="w-full font-bold glow-primary">
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          ⚠️ Demo only — No real money involved
        </p>
      </div>
    </div>
  );
}
