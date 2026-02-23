export const SERVICE_TYPE_MAP: Record<number, string> = {
  1: 'Water Basic',
  2: 'Water Metered',
  3: 'Water Pre-Paid',
  4: 'Water Availability',
  5: 'Electricity Basic',
  6: 'Electricity Metered',
  7: 'Electricity Pre-Paid',
  8: 'Electricity Availability',
  9: 'Property Rates',
  10: 'Waste Disposal',
  11: 'Sanitation Basic',
  12: 'Vacuum Tank',
  13: 'Sanitation Effluent',
  16: 'Property Rates - Special Rating',
  17: 'Sanitation Availability',
};

export const METER_CLASSIFICATION_MAP: Record<number, string> = {
  1: 'KVA Electricity',
  2: 'KWH Electricity',
  3: 'KWR Electricity',
  4: 'Prepaid Electricity',
  5: 'Prepaid Water',
  6: 'Normal Water',
  7: 'Vacuum Tank',
  8: 'Raw Water',
  9: 'KWH Electricity Combination',
  10: 'Normal Water Combination',
  11: 'KWH Electricity Credit',
};

export function getServiceTypeId(item: any): number | null {
  const id = item.tariffTypeID || item.TariffTypeID || item.tariffTypeId || item.tariffTypeid
    || item.serviceTypeID || item.ServiceTypeID || item.serviceTypeId || item.serviceTypeid
    || item.serviceType_ID || item.ServiceType_ID;
  return id ? Number(id) : null;
}

export function getServiceTypeDesc(item: any): string {
  const id = getServiceTypeId(item);
  if (id && SERVICE_TYPE_MAP[id]) {
    return SERVICE_TYPE_MAP[id];
  }
  return item.serviceDesc || item.ServiceDesc || item.tariffType || item.TariffType
    || item.serviceType || item.serviceTypeDescription || item.description || item.serviceDescription || '';
}

export function getMeterClassificationId(item: any): number | null {
  const id = item.meterClassificationID || item.MeterClassificationID || item.meterClassificationId
    || item.meterClassification_ID || item.MeterClassification_ID
    || item.classificationID || item.classificationId;
  return id ? Number(id) : null;
}

export function getMeterClassificationDesc(item: any): string {
  const id = getMeterClassificationId(item);
  if (id && METER_CLASSIFICATION_MAP[id]) {
    return METER_CLASSIFICATION_MAP[id];
  }
  return item.meterClassificationDesc || item.MeterClassificationDesc
    || item.classification || item.meterClassification || '';
}

export function isServicePrepaidByType(item: any): boolean {
  const id = getServiceTypeId(item) || 0;
  if (id === 3 || id === 7) return true;
  const desc = getServiceTypeDesc(item).toLowerCase();
  return desc.includes('pre-paid') || desc.includes('prepaid') || desc.includes('pre paid');
}

export function isServiceMeteredByType(item: any): boolean {
  const id = Number(item.tariffTypeID || item.serviceTypeID || item.serviceType_ID || item.tariffTypeid || item.serviceTypeid || 0);
  if (id === 2 || id === 6) return true;
  const desc = getServiceTypeDesc(item).toLowerCase();
  return desc.includes('metered') && !desc.includes('pre');
}
