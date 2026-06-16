import { TaxonomyManager } from "@/components/taxonomy/taxonomy-manager";

export default function PayeesPage() {
  return (
    <TaxonomyManager
      title="Payees"
      description="Track who you pay and who pays you."
      endpoint="/api/payees"
      defaultColor="#10b981"
      icon="Store"
    />
  );
}
