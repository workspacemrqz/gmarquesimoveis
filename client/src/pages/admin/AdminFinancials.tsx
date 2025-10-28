import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, Edit, Trash2, TrendingUp, TrendingDown, Repeat, Sparkles, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FinancialTransaction, InsertFinancialTransaction } from "@shared/schema";
import { insertFinancialTransactionSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import { AIFinancialDialog } from "@/components/AIFinancialDialog";
import { PriceInput } from "@/components/ui/masked-input";
import DocumentUploadField from "@/components/DocumentUploadField";

export default function AdminFinancials() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const { data: transactions = [], isLoading } = useQuery<FinancialTransaction[]>({
    queryKey: ["/api/admin/financials"],
  });

  const form = useForm<InsertFinancialTransaction>({
    resolver: zodResolver(insertFinancialTransactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "receita",
      category: "",
      date: new Date().toISOString().split('T')[0],
      frequencyType: "unico",
      dayOfMonth: undefined,
      dayOfWeek: undefined,
      documents: [],
    },
  });

  // Clear fields when frequency type changes
  const frequencyType = form.watch("frequencyType");
  useEffect(() => {
    if (frequencyType !== "semanal") {
      form.setValue("dayOfWeek", undefined);
    }
    if (frequencyType !== "mensal") {
      form.setValue("dayOfMonth", undefined);
    }
  }, [frequencyType, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertFinancialTransaction) => {
      await apiRequest("POST", "/api/admin/financials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials"] });
      setDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: InsertFinancialTransaction }) => {
      await apiRequest("PATCH", `/api/admin/financials/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials"] });
      setDialogOpen(false);
      setEditingTransaction(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/financials/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials"] });
    },
  });

  const handleEdit = (transaction: FinancialTransaction) => {
    setEditingTransaction(transaction);
    form.reset({
      description: transaction.description,
      amount: parseFloat(transaction.amount),
      type: transaction.type,
      category: transaction.category || "",
      date: format(new Date(transaction.date), 'yyyy-MM-dd'),
      frequencyType: transaction.frequencyType || "unico",
      dayOfMonth: transaction.dayOfMonth || undefined,
      dayOfWeek: transaction.dayOfWeek || undefined,
      documents: transaction.documents || [],
    });
    setDialogOpen(true);
  };

  // Handle AI extracted data
  const handleAIExtraction = (extractedData: any) => {
    // Map the AI response type ("entrada"/"saida") to form type ("receita"/"despesa")
    const mappedType = extractedData.type === "entrada" ? "receita" : 
                      extractedData.type === "saida" ? "despesa" : 
                      "receita";
    
    form.reset({
      description: extractedData.description || "",
      amount: extractedData.amount ? parseFloat(extractedData.amount) : 0,
      type: mappedType,
      category: extractedData.category || "",
      date: extractedData.date || new Date().toISOString().split('T')[0],
      frequencyType: extractedData.frequencyType || "unico",
      dayOfMonth: extractedData.dayOfMonth || undefined,
      dayOfWeek: extractedData.dayOfWeek || undefined,
      documents: [],
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: InsertFinancialTransaction) => {
    // Convert amount to string for API
    const submitData = {
      ...data,
      amount: typeof data.amount === 'number' ? data.amount.toString() : data.amount,
    };
    
    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const totalRevenue = transactions
    .filter(t => t.type === 'receita')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'despesa')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const balance = totalRevenue - totalExpense;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
                Financeiro
              </h1>
              <p className="text-muted-foreground">{transactions.length} movimentações registradas</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <AIFinancialDialog 
                onSuccess={handleAIExtraction}
                trigger={
                  <Button 
                    className="bg-gradient-to-r from-accent to-accent/90 border-0" 
                    data-testid="button-ai-registration"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Cadastro com IA
                  </Button>
                }
              />
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  setEditingTransaction(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-transaction">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Movimentação
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Editar Movimentação" : "Nova Movimentação"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="receita">Receita</SelectItem>
                                <SelectItem value="despesa">Despesa</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="frequencyType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frequência *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-frequency">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="unico">Único</SelectItem>
                                <SelectItem value="semanal">Semanal</SelectItem>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="anual">Anual</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                              {field.value === "unico" && "Uma vez só, sem repetição"}
                              {field.value === "semanal" && "Toda semana, sempre no mesmo dia"}
                              {field.value === "mensal" && "Uma vez por mês, sempre no mesmo dia"}
                              {field.value === "anual" && "Uma vez por ano, na mesma data"}
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.watch("frequencyType") === "semanal" ? (
                        <FormField
                          control={form.control}
                          name="dayOfWeek"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dia da Semana *</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  const numValue = parseInt(value);
                                  field.onChange(numValue);
                                }} 
                                value={field.value !== undefined && field.value !== null ? String(field.value) : undefined}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-day-of-week">
                                    <SelectValue placeholder="Selecione o dia" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="0">Domingo</SelectItem>
                                  <SelectItem value="1">Segunda-feira</SelectItem>
                                  <SelectItem value="2">Terça-feira</SelectItem>
                                  <SelectItem value="3">Quarta-feira</SelectItem>
                                  <SelectItem value="4">Quinta-feira</SelectItem>
                                  <SelectItem value="5">Sexta-feira</SelectItem>
                                  <SelectItem value="6">Sábado</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Cobrança toda semana neste dia
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : form.watch("frequencyType") === "mensal" ? (
                        <FormField
                          control={form.control}
                          name="dayOfMonth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dia do Mês *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1" 
                                  max="31" 
                                  placeholder="Dia (1-31)"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "") {
                                      field.onChange(undefined);
                                    } else {
                                      const numVal = parseInt(val);
                                      if (!isNaN(numVal) && numVal >= 1 && numVal <= 31) {
                                        field.onChange(numVal);
                                      }
                                    }
                                  }}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                  data-testid="input-day-of-month" 
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground mt-1">
                                Cobrança todo mês neste dia
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : form.watch("frequencyType") === "anual" ? (
                        <FormField
                          control={form.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data Anual *</FormLabel>
                              <FormControl>
                                <Input {...field} type="date" data-testid="input-date" />
                              </FormControl>
                              <p className="text-xs text-muted-foreground mt-1">
                                Cobrança todo ano nesta data
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <FormField
                          control={form.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data *</FormLabel>
                              <FormControl>
                                <Input {...field} type="date" data-testid="input-date" />
                              </FormControl>
                              <p className="text-xs text-muted-foreground mt-1">
                                Cobrança única nesta data
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição *</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Descrição da movimentação" rows={3} data-testid="textarea-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor *</FormLabel>
                            <FormControl>
                              <PriceInput 
                                value={field.value} 
                                onChange={field.onChange}
                                data-testid="input-amount" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categoria</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ""} placeholder="Ex: Comissão, Aluguel..." data-testid="input-category" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="documents"
                      render={({ field }) => (
                        <FormItem>
                          <DocumentUploadField
                            value={field.value || []}
                            onChange={field.onChange}
                            label="Documentos"
                            disabled={createMutation.isPending || updateMutation.isPending}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setEditingTransaction(null);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-save"
                      >
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Receitas</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatPrice(totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Despesas</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatPrice(totalExpense)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg ${balance >= 0 ? 'bg-primary/10' : 'bg-destructive/10'} flex items-center justify-center`}>
                    <DollarSign className={`h-6 w-6 ${balance >= 0 ? 'text-primary' : 'text-destructive'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatPrice(balance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-6 bg-muted animate-pulse rounded mb-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <DollarSign className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhuma movimentação registrada</h3>
                <p className="text-muted-foreground">
                  Clique em "Nova Movimentação" para adicionar a primeira
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {transactions.map((transaction) => (
                <Card key={transaction.id} data-testid={`card-transaction-${transaction.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{transaction.description}</h3>
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                            transaction.type === 'receita' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                              : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {transaction.type === 'receita' ? 'Receita' : 'Despesa'}
                          </span>
                          {(transaction.frequencyType === 'semanal' || transaction.frequencyType === 'mensal' || transaction.frequencyType === 'anual') && (
                            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                              <Repeat className="h-3 w-3" />
                              {transaction.frequencyType === 'semanal' ? 'Semanal' : transaction.frequencyType === 'mensal' ? 'Mensal' : 'Anual'}
                            </span>
                          )}
                        </div>
                        <p className={`text-2xl font-bold mb-2 ${
                          transaction.type === 'receita' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatPrice(transaction.amount)}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>{format(new Date(transaction.date), 'dd/MM/yyyy')}</span>
                          {transaction.category && <span>{transaction.category}</span>}
                          {transaction.frequencyType === 'semanal' && transaction.dayOfWeek !== null && transaction.dayOfWeek !== undefined && (
                            <span>
                              Toda {['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][transaction.dayOfWeek]}
                            </span>
                          )}
                          {transaction.frequencyType === 'mensal' && transaction.dayOfMonth && (
                            <span>Dia {transaction.dayOfMonth} de cada mês</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(transaction)}
                          data-testid={`button-edit-${transaction.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setTransactionToDelete(transaction.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-${transaction.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (transactionToDelete) {
            deleteMutation.mutate(transactionToDelete);
            setTransactionToDelete(null);
          }
        }}
        title="Confirmar exclusão"
        description="Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita."
      />
        </div>
      );
    }
