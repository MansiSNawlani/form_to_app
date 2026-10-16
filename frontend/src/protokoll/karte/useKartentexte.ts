import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/* Every word the map shows, in the interface's language and stable between
   renders, since useBasiskarte builds the map again when its texts change.

   steuerung is MapLibre's own control labels; Map.Title is the accessible name
   of the map region. marken names the two typed markers, a short word on the
   marker and a full one for a screen reader, and amWasser the rings 18d adds. */
export function useKartentexte() {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      steuerung: {
        'Map.Title': t('protokoll.karte.bezeichnung'),
        'NavigationControl.ZoomIn': t('protokoll.karte.vergroessern'),
        'NavigationControl.ZoomOut': t('protokoll.karte.verkleinern'),
        'AttributionControl.ToggleAttribution': t('protokoll.karte.quellenEinblenden'),
        'CooperativeGesturesHandler.WindowsHelpText': t('protokoll.karte.strgScrollen'),
        'CooperativeGesturesHandler.MacHelpText': t('protokoll.karte.befehlScrollen'),
        'CooperativeGesturesHandler.MobileHelpText': t('protokoll.karte.zweiFinger'),
      },
      marken: {
        unten: { kurz: t('protokoll.karte.unten'), lang: t('protokoll.karte.untereGrenze') },
        oben: { kurz: t('protokoll.karte.oben'), lang: t('protokoll.karte.obereGrenze') },
      },
      amWasser: {
        unten: t('protokoll.karte.untereGrenzeAmWasser'),
        oben: t('protokoll.karte.obereGrenzeAmWasser'),
      },
    }),
    [t],
  )
}
