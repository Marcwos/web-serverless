import { backendClient } from '../services/backend-client';

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any) => Promise<any>;
}

// ============ TOOL 1: BUSCAR ANIMAL ============
export const buscarAnimalTool: Tool = {
  name: 'buscar_animal',
  description: 'Busca animales disponibles para adopción por nombre o especie. Usa este tool cuando el usuario quiera encontrar un animal específico o ver animales disponibles.',
  parameters: {
    type: 'object',
    properties: {
      nombre: {
        type: 'string',
        description: 'Nombre del animal a buscar (ej: Max, Luna, Michi)',
      },
      especie: {
        type: 'string',
        description: 'Especie del animal (ej: perro, gato, conejo)',
      },
    },
  },
  execute: async (params: { nombre?: string; especie?: string }) => {
    console.log('🔧 Ejecutando buscar_animal:', params);
    
    const animals = await backendClient.searchAnimals(params.nombre, params.especie);
    
    if (animals.length === 0) {
      return {
        success: true,
        found: false,
        message: 'No se encontraron animales con esos criterios',
        animals: [],
      };
    }
    
    return {
      success: true,
      found: true,
      count: animals.length,
      animals: animals.map((a: any) => ({
        id: a.id,
        nombre: a.name,
        especie: a.species,
        disponible: a.available,
      })),
    };
  },
};

// ============ TOOL 2: VALIDAR DISPONIBILIDAD ============
export const validarDisponibilidadTool: Tool = {
  name: 'validar_disponibilidad',
  description: 'Verifica si un animal específico está disponible para ser adoptado. Usa este tool después de buscar un animal y antes de registrar la adopción.',
  parameters: {
    type: 'object',
    properties: {
      animal_id: {
        type: 'string',
        description: 'ID único del animal a verificar',
      },
    },
    required: ['animal_id'],
  },
  execute: async (params: { animal_id: string }) => {
    console.log('🔧 Ejecutando validar_disponibilidad:', params);
    
    const result = await backendClient.checkAvailability(params.animal_id);
    
    if (!result.found) {
      return {
        success: false,
        available: false,
        reason: 'Animal no encontrado en el sistema',
      };
    }
    
    return {
      success: true,
      animal_id: result.animal_id,
      nombre: result.name,
      especie: result.species,
      available: result.available,
      reason: result.reason,
    };
  },
};

// ============ TOOL 3: REGISTRAR ADOPCIÓN ============
export const registrarAdopcionTool: Tool = {
  name: 'registrar_adopcion',
  description: 'Registra una nueva adopción de un animal. Solo usa este tool después de verificar que el animal está disponible.',
  parameters: {
    type: 'object',
    properties: {
      animal_id: {
        type: 'string',
        description: 'ID del animal a adoptar',
      },
      nombre_adoptante: {
        type: 'string',
        description: 'Nombre completo de la persona que adopta al animal',
      },
    },
    required: ['animal_id', 'nombre_adoptante'],
  },
  execute: async (params: { animal_id: string; nombre_adoptante: string }) => {
    console.log('🔧 Ejecutando registrar_adopcion:', params);
    
    // Primero verificar disponibilidad
    const availability = await backendClient.checkAvailability(params.animal_id);
    
    if (!availability.found) {
      return {
        success: false,
        reason: 'Animal no encontrado',
      };
    }
    
    if (!availability.available) {
      return {
        success: false,
        reason: 'El animal ya fue adoptado',
        animal: {
          id: availability.animal_id,
          nombre: availability.name,
        },
      };
    }
    
    // Crear la adopción
    const adoption = await backendClient.createAdoption(
      params.animal_id,
      params.nombre_adoptante
    );
    
    return {
      success: true,
      message: 'Adopción registrada exitosamente',
      adoption: {
        id: adoption.id,
        animal_id: adoption.animal_id,
        adoptante: adoption.adopter_name,
        estado: adoption.status,
      },
      animal: {
        nombre: availability.name,
        especie: availability.species,
      },
    };
  },
};

// ============ REGISTRY ============
export const toolRegistry: Tool[] = [
  buscarAnimalTool,
  validarDisponibilidadTool,
  registrarAdopcionTool,
];

export function getToolByName(name: string): Tool | undefined {
  return toolRegistry.find((t) => t.name === name);
}

export function getToolsDefinitions() {
  return toolRegistry.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
