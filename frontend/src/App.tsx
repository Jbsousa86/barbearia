import { useMemo, useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import './firebase' // Inicializa o app
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api'

type User = { id: string; name: string; email: string; role: string; phone?: string; isActive?: boolean }
type Service = { id: string; name: string; priceCents: number; durationMin: number }
type Barber = { id: string; userId: string; user: User; workStart: string; workEnd: string; breakStart?: string; breakEnd?: string }
type Barbershop = { id: string; ownerId?: string; name: string; address: string; slug: string; imageUrl?: string; services: Service[]; barbers: Barber[] }

type Appointment = {
  id: string;
  startsAt: string;
  status: string;
  customer: User;
  service: Service;
  barber: Barber;
}

function ProfileForm({ user }: { user: any }) {
  const [name, setName] = useState(user.name || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name, phone, password })
      })
      if (res.ok) {
        const updatedUser = await res.json()
        const fullUser = { ...user, ...updatedUser } // Preserve tokens/shops
        localStorage.setItem('user', JSON.stringify(fullUser))
        setMessage('Perfil atualizado com sucesso!')
        setTimeout(() => window.location.reload(), 1000)
      } else {
        setMessage('Erro ao atualizar perfil.')
      }
    } catch(err) {
      setMessage('Erro de conexão.')
    }
  }

  return (
    <form onSubmit={handleUpdate} className="settings-panel" style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <h2>Meus Dados Cadastrais</h2>
      {message && <div style={{ color: 'var(--status-green)', marginBottom: '10px', fontWeight: 600 }}>{message}</div>}
      <label>Nome Completo
        <input value={name} onChange={e => setName(e.target.value)} required />
      </label>
      <label>WhatsApp (Celular)
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required />
      </label>
      <label>Nova Senha (Opcional)
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Digite apenas se quiser alterar" />
      </label>
      <button className="primary-button" type="submit">Salvar Alterações</button>
    </form>
  )
}

export default function App() {
  return (
    <div className="app-shell platform-shell">
      <Routes>
        <Route path="/" element={<HomePortal />} />
        <Route path="/login" element={<LoginPortal />} />
        <Route path="/admin" element={<SaasPortal />} />
        <Route path="/dashboard" element={<SalonPortal />} />
        <Route path="/:slug" element={<CustomerPortal />} />
      </Routes>
    </div>
  )
}

function HomePortal() {
  return <main className="customer-page" style={{ textAlign: 'center', marginTop: '10vh' }}>
    <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>Barber<span style={{color: 'var(--gold-primary)'}}>.os</span></h1>
    <p style={{ color: 'var(--text-muted)', fontSize: '18px', marginBottom: '40px' }}>
      A plataforma definitiva para gestão de barbearias.
    </p>
    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
      <Link to="/login" className="primary-button" style={{ textDecoration: 'none', padding: '16px 32px' }}>Acessar Plataforma</Link>
      <Link to="/barbearia-central" className="outline-button" style={{ textDecoration: 'none', padding: '16px 32px', fontSize: '16px' }}>Ver barbearia de demonstração</Link>
    </div>
  </main>
}

function LoginPortal() {
  const [isRegister, setIsRegister] = useState(false)
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPhone, setRegisterPhone] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    
    try {
      const auth = getAuth()
      let firebaseUser;
      
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword)
        firebaseUser = cred.user
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        firebaseUser = cred.user
      }

      const token = await firebaseUser.getIdToken()

      // Envia para o backend para sincronizar
      const payload = isRegister ? { name: registerName, phone: registerPhone } : {}
      const res = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        if (isRegister) {
          setSuccess('Conta criada com sucesso! Você já pode fazer login.')
          setIsRegister(false)
          setRegisterPassword('')
          return
        }

        const data = await res.json()
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(data.user))
        if (data.shop) localStorage.setItem('shop', JSON.stringify(data.shop))
        
        if (data.user.role === 'OWNER' || data.user.role === 'SAAS_ADMIN') {
          navigate('/admin')
        } else if (data.user.role === 'BARBER') {
          navigate('/dashboard')
        } else {
          navigate('/barbearia-central')
        }
      } else {
        const err = await res.json()
        setError(err.message || 'Erro ao sincronizar com o servidor.')
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') setError('E-mail ou senha incorretos.')
      else if (err.code === 'auth/email-already-in-use') setError('Este e-mail já está em uso.')
      else setError('Erro de conexão ou autenticação.')
    }
  }

  return <main className="dashboard-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '80vh' }}>
    <div style={{ width: '100%', maxWidth: '400px', marginBottom: '20px' }}>
      <button className="outline-button" onClick={() => navigate(-1)} style={{ border: 'none', background: 'transparent', padding: 0 }}>← Voltar</button>
    </div>
    <section className="booking-card" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
      <h2>{isRegister ? 'Criar Conta' : 'Login Universal'}</h2>
      <p className="subheading">{isRegister ? 'Cadastre-se para agendar' : 'Acesse o seu painel de controle'}</p>
      
      {error && <div style={{ color: 'var(--status-red)', marginTop: '10px', fontSize: '14px', fontWeight: 600 }}>{error}</div>}
      {success && <div style={{ color: 'var(--status-green)', marginTop: '10px', fontSize: '14px', fontWeight: 600 }}>{success}</div>}
      
      <form onSubmit={handleSubmit}>
        {isRegister ? (
          <>
            <label>Nome Completo
              <input type="text" required value={registerName} onChange={e => setRegisterName(e.target.value)} />
            </label>
            <label>Celular (WhatsApp)
              <input type="tel" required placeholder="Ex: 5511999999999" value={registerPhone} onChange={e => setRegisterPhone(e.target.value)} />
            </label>
            <label>E-mail
              <input type="email" required value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} />
            </label>
            <label>Senha
              <input type="password" required value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label>E-mail
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label>Senha
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </label>
          </>
        )}
        <button type="submit" className="primary-button">{isRegister ? 'Cadastrar' : 'Entrar'}</button>
      </form>
      
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button className="outline-button" onClick={() => { setIsRegister(!isRegister); setError('') }} style={{ border: 'none', background: 'transparent', color: 'var(--gold-primary)' }}>
          {isRegister ? 'Já tenho uma conta. Fazer login' : 'Não tem conta? Cadastre-se'}
        </button>
      </div>
    </section>
  </main>
}

function CustomerPortal() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [shop, setShop] = useState<Barbershop | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([])
  const [selectedBarberId, setSelectedBarberId] = useState('')
  const [activeTab, setActiveTab] = useState<'agendar' | 'perfil'>('agendar')
  const [showAppointments, setShowAppointments] = useState(false)

  const userString = localStorage.getItem('user')
  const user = userString ? JSON.parse(userString) : null

  const selectedBarber = shop?.barbers?.find(b => b.id === selectedBarberId)

  const availableSlots = useMemo(() => {
    if (!selectedBarber) return []
    const slots = []
    const parseTime = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m }
    const start = parseTime(selectedBarber.workStart || '09:00')
    const end = parseTime(selectedBarber.workEnd || '18:00')
    const bStart = selectedBarber.breakStart ? parseTime(selectedBarber.breakStart) : -1
    const bEnd = selectedBarber.breakEnd ? parseTime(selectedBarber.breakEnd) : -1

    for (let time = start; time < end; time += 30) {
      if (bStart !== -1 && bEnd !== -1 && time >= bStart && time < bEnd) continue;
      const hh = String(Math.floor(time / 60)).padStart(2, '0')
      const mm = String(time % 60).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
    return slots
  }, [selectedBarber])

  const fetchMyAppointments = () => {
    if (user && user.id) {
      fetch(`${API_URL}/appointments/customer/${user.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setMyAppointments(data)
        })
        .catch(console.error)
    }
  }

  useEffect(() => {
    fetch(`${API_URL}/barbershops/slug/${slug}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { setShop(data); setLoading(false) })
      .catch(() => setLoading(false))
      
    fetchMyAppointments()
  }, [slug])

  async function onBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!shop || !user) return
    const target = event.currentTarget // Save reference before await
    const form = new FormData(target)
    const name = String(form.get('name')).trim()
    const time = String(form.get('time'))
    const serviceId = String(form.get('serviceId'))
    const barberId = String(form.get('barberId'))

    if (!name || !time || !serviceId || !barberId) return

    const selectedService = shop.services.find(s => s.id === serviceId)
    const selectedBarberObj = shop.barbers.find(b => b.id === barberId)

    if (!window.confirm(`Tem certeza que deseja agendar ${selectedService?.name} às ${time}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name, time, serviceId, barberId })
      })

      if (res.ok) {
        const barberPhone = selectedBarberObj?.user?.phone
        if (barberPhone && selectedService) {
          const cleanPhone = barberPhone.replace(/\D/g, '')
          const msg = `Olá ${selectedBarberObj?.user?.name}! Acabei de agendar um(a) *${selectedService.name}* para às *${time}* pelo aplicativo. Podemos confirmar?`
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank')
        }

        setNotice(`✅ Sucesso! Seu horário às ${time} foi agendado.`)
        target.reset()
        fetchMyAppointments()
      } else {
        const err = await res.json()
        setNotice(`⚠️ Erro: ${err.message || 'Falha ao agendar.'}`)
      }
    } catch {
      setNotice('⚠️ Erro de conexão.')
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate('/')
  }

  if (loading) return <main className="customer-page"><p>Carregando barbearia...</p></main>
  if (!shop) return <main className="customer-page"><h1>Barbearia não encontrada (/{slug})</h1></main>

  return <main className="customer-page">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <button className="outline-button" onClick={() => navigate('/')} style={{ border: 'none', background: 'transparent', padding: 0 }}>← Voltar para o início</button>
      {user ? (
        <nav style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className={`outline-button ${activeTab === 'agendar' ? 'active' : ''}`} onClick={() => setActiveTab('agendar')} style={{ padding: '6px 12px' }}>Agendar</button>
          <button className={`outline-button ${activeTab === 'perfil' ? 'active' : ''}`} onClick={() => setActiveTab('perfil')} style={{ padding: '6px 12px' }}>Meu Perfil</button>
          <button onClick={handleLogout} className="outline-button" style={{ color: 'var(--status-red)', borderColor: 'var(--status-red)', padding: '6px 12px' }}>Sair</button>
        </nav>
      ) : (
        <button className="primary-button" onClick={() => navigate('/login')} style={{ padding: '6px 16px' }}>Fazer Login</button>
      )}
    </div>
    {notice && <div className="global-notice" style={{marginBottom: '40px'}}>{notice}<button onClick={() => setNotice('')}>×</button></div>}
    
    <div className="customer-content-grid">
      <header className="hero-banner" style={{
        backgroundImage: shop.imageUrl ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${shop.imageUrl.startsWith('http') ? shop.imageUrl : API_URL.replace('/api', '') + shop.imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: shop.imageUrl ? '#fff' : 'inherit'
      }}>
        <p className="eyebrow" style={{ color: shop.imageUrl ? '#fff' : undefined }}>BARBEARIA</p>
        <h1>{shop.name}</h1>
        <p style={{ color: shop.imageUrl ? '#eee' : undefined }}>{shop.address}</p>
        <div className="hero-points">
          <span style={{ color: shop.imageUrl ? '#eee' : undefined }}>✔️ Equipe qualificada</span>
          <span style={{ color: shop.imageUrl ? '#eee' : undefined }}>✔️ Confirmação pelo WhatsApp</span>
          <span style={{ color: shop.imageUrl ? '#eee' : undefined }}>✔️ Gestão na palma da mão</span>
        </div>
      </header>

      <div className="right-column">
        {activeTab === 'perfil' ? (
          <div>
            <ProfileForm user={user} />
          </div>
        ) : (
          <>
            <section className="booking-card">
              <div>
                <h2>Agendar atendimento</h2>
                <p className="subheading">Escolha seu serviço e profissional.</p>
              </div>
              
              {user && user.role !== 'CUSTOMER' ? (
                <div style={{ textAlign: 'center', margin: '40px 0', color: 'var(--text-muted)' }}>
                  <p>Sua conta é de <strong>{user.role}</strong>.</p>
                  <p>Apenas clientes podem agendar horários por esta tela.</p>
                </div>
              ) : (
                <form className="booking-form" onSubmit={onBook}>
                  {user ? (
                    <label>Seu nome
                      <input name="name" readOnly value={user.name} style={{ background: 'var(--bg-color)', color: 'var(--text-muted)' }} />
                    </label>
                  ) : (
                    <div style={{ marginBottom: '15px', padding: '15px', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <p style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 500 }}>Você precisa estar logado para agendar.</p>
                      <button type="button" className="outline-button" onClick={() => navigate('/login')}>Fazer Login ou Cadastrar</button>
                    </div>
                  )}
                
                <label>Serviço
                  <select name="serviceId" required disabled={!user}>
                    <option value="">Selecione o serviço</option>
                    {shop.services?.map(s => <option key={s.id} value={s.id}>{s.name} · R$ {(s.priceCents / 100).toFixed(2)}</option>)}
                  </select>
                </label>
                <div className="form-row">
                  <label>Profissional
                    <select name="barberId" required disabled={!user} value={selectedBarberId} onChange={e => setSelectedBarberId(e.target.value)}>
                      <option value="">Selecione o barbeiro</option>
                      {shop.barbers?.map(b => <option key={b.id} value={b.id}>{b.user.name}</option>)}
                    </select>
                  </label>
                  <label>Horário
                    <select name="time" required disabled={!user || !selectedBarber}>
                      <option value="">{selectedBarber ? 'Selecione o horário' : 'Escolha um profissional'}</option>
                      {availableSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                    </select>
                  </label>
                </div>
                <button className="primary-button" type="submit" disabled={!user}>
                  {user ? 'Confirmar agendamento' : 'Faça login primeiro'}
                </button>
              </form>
              )}
            </section>

            {user && myAppointments.length > 0 && (
              <div style={{ margin: '20px auto 0 auto', maxWidth: '600px', width: '100%' }}>
                <button 
                  type="button" 
                  className="outline-button" 
                  onClick={() => setShowAppointments(!showAppointments)}
                  style={{ width: '100%' }}
                >
                  {showAppointments ? 'Ocultar Meus Agendamentos' : 'Ver Meus Agendamentos'}
                </button>

                {showAppointments && (
                  <section className="booking-card" style={{ marginTop: '10px' }}>
                    <h2>Meus Agendamentos</h2>
                    <div className="appointment-list" style={{ marginTop: '20px' }}>
                      {myAppointments.map(item => {
                        const date = new Date(item.startsAt)
                        const dateStr = date.toLocaleDateString()
                        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        return (
                          <div className="appointment" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div className="appointment-info" style={{ marginLeft: 0 }}>
                              <strong>{item.service?.name}</strong>
                              <span>{dateStr} às {timeStr} <b>•</b> {item.barber?.user?.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {item.status === 'SCHEDULED' && <span className="status orange">Aguardando</span>}
                              {item.status === 'CONFIRMED' && <span className="status green">Confirmado</span>}
                              {item.status === 'CANCELED' && <span className="status red" style={{color: 'var(--status-red)', borderColor: 'var(--status-red)'}}>Cancelado</span>}
                              {item.status === 'FINISHED' && <span className="status" style={{color: 'var(--text-muted)', borderColor: 'var(--text-muted)'}}>Finalizado</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </main>
}

function SalonPortal() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [shops, setShops] = useState<Barbershop[]>([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'agenda' | 'settings' | 'perfil'>('agenda')
  const navigate = useNavigate()

  const userString = localStorage.getItem('user')
  const user = userString ? JSON.parse(userString) : null

  const fetchData = () => {
    if (!user) return;
    fetch(`${API_URL}/appointments?userId=${user.id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAppointments(data)
      })
      .catch(console.error)

    fetch(`${API_URL}/barbershops?userId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setShops(data)
      })
      .catch(console.error)
  }

  useEffect(() => {
    // Basic auth check
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }
    fetchData()
  }, [navigate])

  // Select the correct shop and barber based on the logged in user
  const shop = shops[0]
  const barber = shop?.barbers?.find(b => b.userId === user?.id) || shop?.barbers?.[0]
  const isOwner = shop?.ownerId === user?.id

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${API_URL}/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ status })
    })
    fetchData()
  }

  const addService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!shop) return
    const formTarget = event.currentTarget
    const form = new FormData(formTarget)
    const name = String(form.get('name'))
    const durationMin = Number(form.get('durationMin'))
    const priceCents = Math.round(Number(form.get('price')) * 100)
    
    try {
      const res = await fetch(`${API_URL}/services`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name, durationMin, priceCents, barbershopId: shop.id })
      })
      
      if (res.ok) {
        formTarget.reset()
        fetchData()
        alert('Serviço adicionado com sucesso!')
      } else {
        const err = await res.json()
        alert('Erro ao adicionar: ' + (err.message || 'Desconhecido'))
      }
    } catch {
      alert('Erro de conexão ao adicionar serviço.')
    }
  }

  const deleteService = async (id: string) => {
    await fetch(`${API_URL}/services/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    fetchData()
  }

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!barber) return
    const form = new FormData(event.currentTarget)
    const workStart = String(form.get('workStart'))
    const workEnd = String(form.get('workEnd'))
    const breakStart = String(form.get('breakStart'))
    const breakEnd = String(form.get('breakEnd'))
    
    await fetch(`${API_URL}/barbers/${barber.id}/schedule`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ workStart, workEnd, breakStart, breakEnd })
    })
    alert('Horário salvo com sucesso!')
    fetchData()
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate('/')
  }

  return <main className="dashboard-page">
    <div className="dashboard-heading">
      <div>
        <p className="eyebrow">PAINEL DO BARBEIRO</p>
        <h1>Olá, {user?.name || 'Barbeiro'}</h1>
        <p className="subheading">Barbearia: <strong>{shop?.name || 'Carregando...'}</strong> | Link para clientes: <Link to={`/${shop?.slug}`}>barbersaas.com/{shop?.slug}</Link></p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
        <button onClick={handleLogout} className="outline-button">Sair da conta</button>
        {activeTab === 'agenda' && <label className="dashboard-search">Buscar
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou telefone..." />
        </label>}
      </div>
    </div>
    
    <div className="dashboard-tabs">
      <button className={activeTab === 'agenda' ? 'active' : ''} onClick={() => setActiveTab('agenda')}>Agenda do Dia</button>
      <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Configurações & Serviços</button>
      <button className={activeTab === 'perfil' ? 'active' : ''} onClick={() => setActiveTab('perfil')}>Meu Perfil</button>
    </div>

    {activeTab === 'perfil' && (
      <div style={{ marginTop: '40px', marginBottom: '40px' }}>
        <ProfileForm user={user} />
      </div>
    )}

    {activeTab === 'agenda' && (() => {
      // Owner sees all, Barber sees only theirs
      const visibleAppointments = isOwner ? appointments : appointments.filter(a => a.barber?.userId === user?.id)
      
      const validAppointments = visibleAppointments.filter(a => a.status !== 'CANCELED')
      const myRevenue = visibleAppointments.filter(a => a.status !== 'CANCELED').reduce((sum, item) => sum + (item.service?.priceCents || 0), 0) / 100
      const totalRevenue = appointments.filter(a => a.status !== 'CANCELED').reduce((sum, item) => sum + (item.service?.priceCents || 0), 0) / 100

      // Daily progress logic
      const today = new Date()
      const todayString = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
      const myTodayAppointments = validAppointments.filter(a => a.startsAt.startsWith(todayString))
      const todayTotal = myTodayAppointments.length
      const todayFinished = myTodayAppointments.filter(a => a.status === 'FINISHED').length

      // List logic
      const displayAppointments = visibleAppointments.filter(item => {
        if (search.trim()) {
          return `${item.customer?.name} ${item.customer?.phone} ${item.service?.name} ${item.barber?.user?.name}`.toLowerCase().includes(search.toLowerCase())
        }
        return item.startsAt.startsWith(todayString)
      })

      return (
      <>
        <section className="metrics">
          <article className="metric-card">
            <div className="metric-icon coral" style={{ background: 'var(--blue)' }}>▶</div>
            <div>
              <span>Hoje: Finalizados</span>
              <strong>{todayFinished} / {todayTotal}</strong>
              <small className="neutral">progresso diário</small>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-icon coral">◷</div>
            <div><span>Todos Meus</span><strong>{String(validAppointments.length).padStart(2, '0')}</strong><small className="neutral">não cancelados</small></div>
          </article>
          <article className="metric-card">
            <div className="metric-icon green">◉</div>
            <div>
              <span>Meu Faturamento</span>
              <strong>R$ {myRevenue.toFixed(2)}</strong>
              <small className="neutral">previsto/realizado</small>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-icon yellow">★</div>
            <div>
              <span>Total da Barbearia</span>
              <strong>R$ {totalRevenue.toFixed(2)}</strong>
              <small className="neutral">faturamento geral</small>
            </div>
          </article>
        </section>

        <section className="schedule-panel">
          <div className="section-header">
            <div><h2>Atendimentos</h2><p>{search.trim() ? 'Resultados da busca' : 'Hoje'}</p></div>
          </div>
          <div className="appointment-list">
            {displayAppointments.length ? displayAppointments.map((item) => {
              const time = new Date(item.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div className="appointment" key={item.id}>
                  <time>{time}</time>
                  <div className="appointment-bar" />
                  <div className="appointment-info">
                    <strong>{item.customer?.name}</strong>
                    <span>{item.service?.name} <b>•</b> {item.barber?.user?.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {item.status === 'SCHEDULED' && <span className="status orange">Aguardando</span>}
                    {item.status === 'CONFIRMED' && <span className="status green">Confirmado</span>}
                    {item.status === 'CANCELED' && <span className="status red" style={{color: 'var(--status-red)', borderColor: 'var(--status-red)'}}>Cancelado</span>}
                    {item.status === 'FINISHED' && <span className="status" style={{color: 'var(--text-muted)', borderColor: 'var(--text-muted)'}}>Finalizado</span>}
                    
                    <div style={{ display: 'flex', gap: '4px', marginLeft: '10px', alignItems: 'center' }}>
                      {item.status === 'SCHEDULED' && (
                        <button className="outline-button" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => updateStatus(item.id, 'CONFIRMED')}>✔️ Confirmar</button>
                      )}
                      {item.status === 'CONFIRMED' && (
                        <button className="outline-button" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--gold-primary)', borderColor: 'var(--gold-primary)' }} onClick={() => updateStatus(item.id, 'FINISHED')}>🏁 Finalizar</button>
                      )}
                      {item.status !== 'CANCELED' && item.status !== 'FINISHED' && (
                        <button className="outline-button" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--status-red)', borderColor: 'var(--status-red)' }} onClick={() => { if(window.confirm('Tem certeza que deseja cancelar este horário?')) updateStatus(item.id, 'CANCELED') }}>❌ Cancelar</button>
                      )}
                      {item.customer?.phone && (
                        <a href={`https://wa.me/${item.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + item.customer.name + ', tudo bem? Aqui é da barbearia.')}`} target="_blank" rel="noreferrer" className="outline-button" style={{color: '#25D366', borderColor: '#25D366', textDecoration: 'none', padding: '4px 8px', fontSize: '12px'}}>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            }) : <p className="empty-state">Nenhum agendamento encontrado.</p>}
          </div>
        </section>
      </>
      )
    })()}

    {activeTab === 'settings' && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <section className="settings-panel">
          <div className="section-header">
            <div><h2>Horário de Funcionamento</h2><p>Defina quando você está disponível</p></div>
          </div>
          <form onSubmit={saveSchedule}>
            <div className="form-row">
              <label>Início do expediente
                <input name="workStart" type="time" defaultValue={(barber as any)?.workStart || '09:00'} required />
              </label>
              <label>Fim do expediente
                <input name="workEnd" type="time" defaultValue={(barber as any)?.workEnd || '18:00'} required />
              </label>
            </div>
            <div className="form-row" style={{ marginTop: '10px' }}>
              <label>Início do almoço
                <input name="breakStart" type="time" defaultValue={(barber as any)?.breakStart || '12:00'} />
              </label>
              <label>Fim do almoço
                <input name="breakEnd" type="time" defaultValue={(barber as any)?.breakEnd || '13:00'} />
              </label>
            </div>
            <button className="primary-button" type="submit" style={{ marginTop: '15px' }}>Salvar Horários</button>
          </form>
        </section>

        <section className="settings-panel">
          <div className="section-header">
            <div><h2>Serviços e Cortes</h2><p>Catálogo atual</p></div>
          </div>
          <div className="service-list" style={{ marginBottom: '30px' }}>
            {shop?.services?.map(s => (
              <div className="service-item" key={s.id}>
                <div className="service-info">
                  <strong>{s.name}</strong>
                  <span>{s.durationMin} min</span>
                </div>
                <div className="service-price">R$ {(s.priceCents / 100).toFixed(2)}</div>
                <button className="danger-button" type="button" onClick={() => deleteService(s.id)}>Remover</button>
              </div>
            ))}
            {!shop?.services?.length && <p className="empty-state">Nenhum serviço cadastrado.</p>}
          </div>
          
          <h4 style={{ marginBottom: '10px' }}>Adicionar novo serviço</h4>
          <form onSubmit={addService}>
            <label>Nome do serviço
              <input name="name" required placeholder="Ex: Corte Degradê" />
            </label>
            <div className="form-row">
              <label>Preço (R$)
                <input name="price" type="number" step="0.01" min="0" required placeholder="35.00" />
              </label>
              <label>Duração (minutos)
                <input name="durationMin" type="number" min="5" required placeholder="30" />
              </label>
            </div>
            <button className="outline-button" type="submit" style={{ marginTop: '10px' }}>+ Adicionar Serviço</button>
          </form>
        </section>
      </div>
    )}
  </main>
}

function SaasPortal() {
  const [shops, setShops] = useState<Barbershop[]>([])
  const [showShopForm, setShowShopForm] = useState(false)
  const [activeShopId, setActiveShopId] = useState<string>('')
  const [editingShop, setEditingShop] = useState<{ id: string, name: string, address: string } | null>(null)
  const navigate = useNavigate()

  const userString = localStorage.getItem('user')
  const user = userString ? JSON.parse(userString) : null

  const fetchData = () => {
    fetch(`${API_URL}/barbershops`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setShops(data)
      })
      .catch(console.error)
  }
  const fetchShops = fetchData

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }
    fetchData()
  }, [navigate])

  const handleLogout = () => {
    localStorage.clear()
    navigate('/')
  }

  // Cálculos financeiros do SaaS
  const realMRR = shops.reduce((total, shop) => {
    const barberCount = shop.barbers?.length || 0;
    const additionalBarbers = Math.max(0, barberCount - 1);
    const shopMonthly = 50 + (additionalBarbers * 25);
    return total + shopMonthly;
  }, 0);

  const createShop = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await fetch(`${API_URL}/barbershops`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        name: String(form.get('name')),
        address: String(form.get('address')),
        slug: String(form.get('slug')),
        ownerId: user?.id
      })
    })
    setShowShopForm(false)
    fetchData()
  }

  const handleEditShop = async (e: FormEvent<HTMLFormElement>, shopId: string) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await fetch(`${API_URL}/barbershops/${shopId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        name: String(form.get('name')),
        address: String(form.get('address')),
        imageUrl: String(form.get('imageUrl') || '')
      })
    })
    setEditingShop(null)
    fetchShops()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, shopId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    await fetch(`${API_URL}/barbershops/${shopId}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });
    fetchShops();
  };

  const createBarber = async (e: FormEvent<HTMLFormElement>, shopId: string) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const res = await fetch(`${API_URL}/barbershops/${shopId || activeShopId}/barbers`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        phone: String(form.get('phone'))
      })
    })
    
    if (res.ok) {
      setActiveShopId('')
      fetchData()
      alert('Barbeiro cadastrado com sucesso!')
    } else {
      const err = await res.json()
      alert('Erro: ' + (err.message || 'Falha ao cadastrar'))
    }
  }

  const toggleBarberStatus = async (userId: string) => {
    await fetch(`${API_URL}/users/${userId}/toggle-status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    fetchData()
  }

  return <main className="dashboard-page">
    <div className="dashboard-heading">
      <div>
        <p className="eyebrow">PAINEL DA PLATAFORMA</p>
        <h1>Visão do SaaS</h1>
        <p className="subheading">Acompanhe a saúde comercial e operacional da sua plataforma.</p>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={handleLogout} className="outline-button">Sair</button>
        <button className="primary-button" onClick={() => setShowShopForm(!showShopForm)}>{showShopForm ? 'Cancelar' : '+ Nova barbearia'}</button>
      </div>
    </div>
    
    {showShopForm && (
      <section className="settings-panel" style={{ marginBottom: '30px' }}>
        <h3>Cadastrar Nova Barbearia</h3>
        <form onSubmit={createShop}>
          <label>Nome da Barbearia
            <input name="name" required placeholder="Ex: Barbearia do Zé" />
          </label>
          <div className="form-row">
            <label>Endereço
              <input name="address" required placeholder="Rua XYZ, 123" />
            </label>
            <label>Link / Slug
              <input name="slug" required placeholder="barbearia-do-ze" />
            </label>
          </div>
          <button className="primary-button" type="submit" style={{ marginTop: '10px' }}>Salvar Barbearia</button>
        </form>
      </section>
    )}

    <section className="metrics">
      <article className="metric-card">
        <div className="metric-icon coral">♧</div>
        <div><span>Barbearias ativas</span><strong>{shops.length}</strong></div>
      </article>
      <article className="metric-card">
        <div className="metric-icon green">\$</div>
        <div><span>MRR (Recorrente)</span><strong>R$ {realMRR.toFixed(2).replace('.', ',')}</strong><small className="status green">Mensalidade SaaS</small></div>
      </article>
      <article className="metric-card">
        <div className="metric-icon yellow">★</div>
        <div><span>Novos cadastros</span><strong>0</strong><small className="neutral">nos últimos 30 dias</small></div>
      </article>
    </section>

    <section className="schedule-panel business-panel">
      <div className="section-header">
        <div><h2>Barbearias cadastradas</h2><p>Controle de contas e links únicos</p></div>
      </div>
      <div className="business-list">
        <div className="business-row business-label"><span>BARBEARIA</span><span>LINK EXCLUSIVO</span><span>EQUIPE</span><span>STATUS</span></div>
        {shops.map((shop) => (
          <div key={shop.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '10px' }}>
            {editingShop?.id === shop.id ? (
              <form onSubmit={(e) => handleEditShop(e, shop.id)} className="business-row" style={{ alignItems: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <input name="name" defaultValue={editingShop.name} required style={{ padding: '4px', fontSize: '14px' }} placeholder="Nome" />
                  <input name="address" defaultValue={editingShop.address} required style={{ padding: '4px', fontSize: '12px' }} placeholder="Endereço" />
                  <input name="imageUrl" defaultValue={shop.imageUrl || ''} style={{ padding: '4px', fontSize: '12px' }} placeholder="Link da Imagem (Opcional)" />
                  <div style={{ fontSize: '12px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <span style={{color: 'var(--text-muted)'}}>ou Enviar Arquivo:</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, shop.id)} style={{ fontSize: '11px', width: '150px' }} />
                  </div>
                </div>
                <div>
                  <span style={{color: 'var(--text-muted)'}}>{shop.slug} (Fixo)</span>
                </div>
                <div></div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="primary-button" style={{ padding: '6px 12px', fontSize: '12px' }}>Salvar</button>
                  <button type="button" className="outline-button" onClick={() => setEditingShop(null)} style={{ padding: '6px 12px', fontSize: '12px' }}>Cancelar</button>
                </div>
              </form>
            ) : (
              <div className="business-row" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                <div>
                  <strong>{shop.name}</strong>
                  <small>{shop.address}</small>
                </div>
                <div>
                  <a href={`/${shop.slug}`} target="_blank" rel="noreferrer" style={{color: 'var(--brand-primary)', textDecoration: 'none'}}>{shop.slug}</a>
                </div>
                <div>{shop.barbers?.length || 0} barbeiros</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="outline-button" onClick={() => setEditingShop({ id: shop.id, name: shop.name, address: shop.address })} style={{ padding: '6px 12px', fontSize: '12px' }}>Editar</button>
                  <button className="outline-button" onClick={() => setActiveShopId(activeShopId === shop.id ? '' : shop.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>Novo Barbeiro</button>
                </div>
              </div>
            )}
            
            <div style={{ paddingLeft: '20px', marginTop: '10px' }}>
              {shop.barbers?.map(barber => (
                <div key={barber.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
                  <span>{barber.user.name} ({barber.user.email})</span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {barber.user.isActive ? <span className="status green">Ativo</span> : <span className="status red">Inativo</span>}
                    <button className="outline-button" style={{ padding: '4px 8px', fontSize: '12px', color: barber.user.isActive ? 'var(--status-red)' : 'var(--gold-primary)', borderColor: barber.user.isActive ? 'var(--status-red)' : 'var(--gold-primary)' }} onClick={() => toggleBarberStatus(barber.user.id)}>
                      {barber.user.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {activeShopId === shop.id && (
              <form onSubmit={(e) => createBarber(e, shop.id)} style={{ padding: '15px', background: 'var(--bg-color)', borderRadius: '8px', marginTop: '15px' }}>
                <h4 style={{ marginBottom: '10px' }}>Conta de Acesso do Barbeiro</h4>
                <div className="form-row">
                  <label>Nome
                    <input name="name" required placeholder="Ex: Diego" />
                  </label>
                  <label>E-mail de Login
                    <input name="email" type="email" required placeholder="diego@barbearia.com" />
                  </label>
                  <label>WhatsApp
                    <input name="phone" type="tel" required placeholder="5511999999999" />
                  </label>
                  <label>Senha Inicial
                    <input name="password" required placeholder="Senha segura" />
                  </label>
                </div>
                <button className="primary-button" type="submit" style={{ marginTop: '10px', padding: '6px 12px' }}>Criar Conta e Adicionar</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </section>
  </main>
}
