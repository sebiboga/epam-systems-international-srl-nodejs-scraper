import { jest } from '@jest/globals';

const CACHED_ANAF_DATA = {
  cui: 33159615,
  name: "EPAM SYSTEMS INTERNATIONAL SRL",
  address: "MUNICIPIUL BUCUREŞTI, SECTOR 1, BLD IANCU DE HUNEDOARA, NR.48, ET.9",
  registrationNumber: "J2014005735405",
  phone: "",
  fax: "",
  postalCode: "11745",
  caenCode: "6220",
  iban: "",
  registrationState: "TRANSFER(SOSIRE) din data 20.04.2022",
  registrationDate: "2014-05-14",
  fiscalAuthority: "Direcţia Generală a Finanţelor Publice Municipiul Bucureşti",
  ownershipForm: "PROPR.PRIVATA-CAPITAL PRIVAT STRAIN",
  organizationForm: "PERSOANA JURIDICA",
  legalForm: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
  vatRegistered: true,
  cashBasisVat: false,
  cashBasisVatStart: null,
  cashBasisVatEnd: null,
  inactive: false,
  inactiveSince: "2018-12-27",
  reactivatedSince: "2020-05-13",
  splitVat: false,
  eFacturaRegistered: false,
  headquartersAddress: {
    street: "Bld. Iancu de Hunedoara",
    number: "48",
    locality: "Sector 1 Mun. Bucureşti",
    county: "MUNICIPIUL BUCUREŞTI",
    country: "",
    postalCode: "11745"
  },
  fiscalAddress: {
    street: "",
    number: "",
    locality: "",
    county: "",
    country: "",
    postalCode: ""
  },
  administrators: [
    {
      name: "JASON PETERSON",
      role: "administrator"
    }
  ],
  authorizedCaenCodes: ["6210", "6220", "6290", "7020", "8559"],
  onrcStatus: 1048,
  onrcStatusLabel: "Funcțiune"
};

describe('demoanaf.js', () => {
  let demoanaf;
  
  beforeAll(async () => {
    demoanaf = await import('../../demoanaf.js');
  });

  describe('searchCompany', () => {
    it('should return array of companies for valid brand', async () => {
      const results = await demoanaf.searchCompany('EPAM');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('cui');
      expect(results[0]).toHaveProperty('name');
    });

    it('should return empty array for non-existent brand', async () => {
      const results = await demoanaf.searchCompany('NonExistentBrandXYZ123');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should include statusLabel in results', async () => {
      const results = await demoanaf.searchCompany('EPAM');
      
      expect(results[0]).toHaveProperty('statusLabel');
    });
  });

  describe('getCompanyFromANAF', () => {
    it('should return company data for valid CIF with fallback', async () => {
      const data = await demoanaf.getCompanyFromANAFWithFallback('33159615', CACHED_ANAF_DATA);
      
      expect(data).toBeDefined();
      expect(data.cui).toBe(33159615);
      expect(data.name).toBe('EPAM SYSTEMS INTERNATIONAL SRL');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
    }, 30000);

    it('should throw error for invalid CIF', async () => {
      await expect(demoanaf.getCompanyFromANAF('99999999')).rejects.toThrow();
    }, 30000);
  });
});