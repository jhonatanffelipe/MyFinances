import { useState } from 'react';
import { History } from 'lucide-react';
import { ImportV1Wizard } from '../../components/ImportV1/ImportV1Wizard';
import { SecondaryButton, Shell } from '../../components/ui';
import { useAppState } from '../../contexts/AppStateContext';

/** Logo depois de criar a família: importar o banco da v1 ou começar do zero. */
export function V1OfferView() {
  const { apply } = useAppState();
  const [importing, setImporting] = useState(false);
  const finish = async () => apply(await window.appAPI.dismissV1Offer());

  return (
    <Shell
      icon={History}
      title="Você já usa o MyFinances v1?"
      subtitle="Traga seus lançamentos, fixos, categorias e cartões para a família. Dá para fazer depois pelo Perfil."
      wide
    >
      {importing ? (
        <ImportV1Wizard onDone={finish} />
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm cursor-pointer"
          >
            Importar meu banco da v1
          </button>
          <SecondaryButton onClick={finish}>Começar do zero</SecondaryButton>
        </div>
      )}
    </Shell>
  );
}
