import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <EmptyState
      icon={<Compass size={26} />}
      title="Off the pitch"
      message="That page doesn't exist. Head back to the tournament."
      action={
        <Link to="/" className="btn btn-primary">
          Back to tournament
        </Link>
      }
    />
  )
}
