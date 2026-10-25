import { Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistPage from './pages/PlaylistPage';
import Import from './pages/Import';
import Account from './pages/Account';
import Shared from './pages/Shared';
import Profile from './pages/Profile';

function PlaylistRoute() {
  const { id } = useParams();
  return <PlaylistPage key={id} />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="library" element={<Library />} />
        <Route path="liked" element={<PlaylistPage liked />} />
        <Route path="playlist/:id" element={<PlaylistRoute />} />
        <Route path="import" element={<Import />} />
        <Route path="account" element={<Account />} />
        <Route path="s/:token" element={<Shared />} />
        <Route path="u/:handle" element={<Profile />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
