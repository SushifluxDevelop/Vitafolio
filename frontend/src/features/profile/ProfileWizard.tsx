import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { PersonalTab } from '../../pages/profile/PersonalTab'
import { ExperiencesTab } from '../../pages/profile/ExperiencesTab'
import { EducationsTab } from '../../pages/profile/EducationsTab'
import { SkillsTab } from '../../pages/profile/SkillsTab'
import { LanguagesTab } from '../../pages/profile/LanguagesTab'
import { PreviewTab } from '../../pages/profile/PreviewTab'
import type { Profile } from '../../api/types'

interface ProfileWizardProps {
  profile: Profile
  onExitWizard: () => void
}

const STEPS = [
  { id: 1, title: 'Stammdaten & Kontakt', description: 'Name, Kontaktdaten, Anschrift und Kurzprofil' },
  { id: 2, title: 'Berufserfahrung', description: 'Berufliche Stationen und Praxiserfahrung' },
  { id: 3, title: 'Ausbildung & Studium', description: 'Schulbildung, Berufsausbildung und Hochschulabschlüsse' },
  { id: 4, title: 'Kenntnisse & Sprachen', description: 'Fachliche Kernkompetenzen und Fremdsprachen' },
  { id: 5, title: 'Vorschau & Fertigstellung', description: 'PDF-Vorschau und Export' },
]

export function ProfileWizard({ profile, onExitWizard }: ProfileWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      onExitWizard()
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Wizard Header Bar */}
      <div className="card p-5 border-l-4 border-l-primary flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Icon name="sparkles" size={16} />
            Schritt-für-Schritt Assistent
          </div>
          <h2 className="text-xl font-bold text-ink mt-0.5">
            Schritt {currentStep} von {STEPS.length}: {STEPS[currentStep - 1]?.title}
          </h2>
          <p className="text-sm text-ink-muted">
            {STEPS[currentStep - 1]?.description}
          </p>
        </div>

        <Button variant="secondary" onClick={onExitWizard} small>
          <Icon name="layoutBoard" className="mr-1.5" size={15} />
          Klassische Ansicht
        </Button>
      </div>

      {/* Step Stepper Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STEPS.map((step) => {
          const isActive = step.id === currentStep
          const isDone = step.id < currentStep
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setCurrentStep(step.id)}
              className={`p-3 rounded-lg border text-left transition-all ${
                isActive
                  ? 'border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary'
                  : isDone
                  ? 'border-border bg-canvas text-ink hover:bg-canvas-subtle'
                  : 'border-border/60 bg-canvas/60 text-ink-muted opacity-80'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold">Schritt {step.id}</span>
                {isDone && <Icon name="circleCheck" size={14} className="text-success" />}
              </div>
              <div className="text-xs truncate">{step.title}</div>
            </button>
          )
        })}
      </div>

      {/* Step Content */}
      <div className="card p-6 min-h-[400px]">
        {currentStep === 1 && <PersonalTab profile={profile} />}
        {currentStep === 2 && <ExperiencesTab profile={profile} />}
        {currentStep === 3 && <EducationsTab profile={profile} />}
        {currentStep === 4 && (
          <div className="space-y-8">
            <div>
              <h3 className="text-base font-semibold text-ink mb-3">Fachliche Kompetenzen</h3>
              <SkillsTab profile={profile} />
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-base font-semibold text-ink mb-3">Sprachkenntnisse</h3>
              <LanguagesTab profile={profile} />
            </div>
          </div>
        )}
        {currentStep === 5 && <PreviewTab />}
      </div>

      {/* Wizard Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="secondary"
          onClick={handlePrev}
          disabled={currentStep === 1}
        >
          <Icon name="chevronLeft" className="mr-1.5" size={17} />
          Zurück
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="confirm"
            onClick={handleNext}
          >
            {currentStep === STEPS.length ? (
              <>
                <Icon name="check" className="mr-1.5" size={17} />
                Assistent abschließen
              </>
            ) : (
              <>
                Weiter zum nächsten Schritt
                <Icon name="chevronRight" className="ml-1.5" size={17} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
