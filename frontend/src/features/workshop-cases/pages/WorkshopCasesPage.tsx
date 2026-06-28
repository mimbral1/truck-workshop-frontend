import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ROUTES } from '../../../config/routes'
import { Button } from '../../../shared/components/Button/Button'
import { Card } from '../../../shared/components/Card/Card'
import { EmptyState } from '../../../shared/components/EmptyState/EmptyState'
import { LoadingState } from '../../../shared/components/LoadingState/LoadingState'
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery'
import { PageContainer } from '../../../shared/layout/PageContainer/PageContainer'
import { CaseCard } from '../components/CaseCard'
import { CaseFilters } from '../components/CaseFilters'
import { CaseTable } from '../components/CaseTable'
import { useWorkshopCases } from '../hooks/useWorkshopCases'
import styles from './WorkshopCasesPage.module.css'

export function WorkshopCasesPage() {
  const { cases, filters, isLoading, setFilters } = useWorkshopCases()
  const isMobile = useIsMobile()

  return (
    <PageContainer>
      <PageHeader
        actions={
          <Link to={ROUTES.caseNew}>
            <Button icon={<Plus size={18} />}>Nuevo caso</Button>
          </Link>
        }
        description="Seguimiento de panas, diagnósticos, reparaciones y cierres."
        title="Casos de taller"
      />
      <CaseFilters filters={filters} setFilters={setFilters} />
      {isMobile ? (
        // En celular la tabla se corta: mostramos cada caso como card legible.
        isLoading ? (
          <Card>
            <LoadingState label="Cargando casos de taller" />
          </Card>
        ) : cases.length > 0 ? (
          <div className={styles.cardList}>
            {cases.map((workshopCase) => (
              <CaseCard key={workshopCase.id} workshopCase={workshopCase} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              title="No hay casos con estos filtros"
              description="Ajusta la búsqueda o limpia filtros para volver a ver casos."
            />
          </Card>
        )
      ) : (
        <Card>
          {isLoading ? <LoadingState label="Cargando casos de taller" /> : <CaseTable cases={cases} />}
        </Card>
      )}
    </PageContainer>
  )
}
