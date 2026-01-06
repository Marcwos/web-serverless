import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnimalService } from './animal.service';

@Controller('animals')
export class AnimalController {
  constructor(private readonly animalService: AnimalService) {}

  // GET /animals - Listar todos o buscar por nombre/especie
  @Get()
  async findAll(
    @Query('name') name?: string,
    @Query('species') species?: string,
  ) {
    const animals = await this.animalService.findAll();
    
    let filtered = animals;
    
    if (name) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(name.toLowerCase())
      );
    }
    
    if (species) {
      filtered = filtered.filter(a => 
        a.species.toLowerCase().includes(species.toLowerCase())
      );
    }
    
    // Solo animales disponibles por defecto
    filtered = filtered.filter(a => a.available);
    
    return filtered;
  }

  // GET /animals/:id - Obtener un animal por ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const animals = await this.animalService.findAll();
    const animal = animals.find(a => a.id === id);
    
    if (!animal) {
      return { error: 'Animal no encontrado', found: false };
    }
    
    return { ...animal, found: true };
  }

  // GET /animals/:id/availability - Verificar disponibilidad
  @Get(':id/availability')
  async checkAvailability(@Param('id') id: string) {
    const animals = await this.animalService.findAll();
    const animal = animals.find(a => a.id === id);
    
    if (!animal) {
      return { 
        available: false, 
        reason: 'Animal no encontrado',
        found: false 
      };
    }
    
    return {
      animal_id: animal.id,
      name: animal.name,
      species: animal.species,
      available: animal.available,
      reason: animal.available ? 'Disponible para adopción' : 'Ya fue adoptado',
      found: true
    };
  }
}
