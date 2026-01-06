import axios from 'axios';

const MS_ANIMAL_URL = 'http://localhost:3001';
const MS_ADOPTION_URL = 'http://localhost:3002';

export class BackendClient {
  // ============ MS-ANIMAL ============
  
  async searchAnimals(name?: string, species?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (name) params.append('name', name);
      if (species) params.append('species', species);
      
      const url = `${MS_ANIMAL_URL}/animals${params.toString() ? '?' + params.toString() : ''}`;
      console.log(`🔍 Buscando animales: ${url}`);
      
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error buscando animales:', error.message);
      throw new Error(`Error al buscar animales: ${error.message}`);
    }
  }

  async getAnimalById(animalId: string): Promise<any> {
    try {
      const url = `${MS_ANIMAL_URL}/animals/${animalId}`;
      console.log(`🔍 Obteniendo animal: ${url}`);
      
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error obteniendo animal:', error.message);
      throw new Error(`Error al obtener animal: ${error.message}`);
    }
  }

  async checkAvailability(animalId: string): Promise<any> {
    try {
      const url = `${MS_ANIMAL_URL}/animals/${animalId}/availability`;
      console.log(`✅ Verificando disponibilidad: ${url}`);
      
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error verificando disponibilidad:', error.message);
      throw new Error(`Error al verificar disponibilidad: ${error.message}`);
    }
  }

  // ============ MS-ADOPTION ============
  
  async createAdoption(animalId: string, adopterName: string): Promise<any> {
    try {
      const url = `${MS_ADOPTION_URL}/adoptions`;
      console.log(`📝 Creando adopción: ${url}`);
      
      const response = await axios.post(url, {
        animal_id: animalId,
        adopter_name: adopterName,
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error creando adopción:', error.message);
      throw new Error(`Error al crear adopción: ${error.message}`);
    }
  }
}

export const backendClient = new BackendClient();
